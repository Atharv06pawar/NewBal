import { db } from './db';
import { supabase, AuthService, getAccountIdForEmail } from './supabase';
import type { Company, Voucher, Ledger, StockItem, Godown, BankAccount, Employee } from '@newbal/shared';

export type SyncState = 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'NEEDS_TABLE' | 'IDLE';

type SyncListener = (state: SyncState, message?: string) => void;

export class CloudSyncEngine {
  private static currentState: SyncState = 'IDLE';
  private static statusMessage: string = '';
  private static listeners: Set<SyncListener> = new Set();
  private static syncInterval: any = null;
  private static realtimeChannel: any = null;
  private static isSyncing = false;
  private static isInitialized = false;
  private static needsSqlSetup = false;
  private static activeUserId: string | null = null;

  private static getDeviceId(): string {
    let id = localStorage.getItem('newbal_device_id');
    if (!id) {
      id = `dev-${navigator.userAgent.includes('Mobile') ? 'mob' : 'desk'}-${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('newbal_device_id', id);
    }
    return id;
  }

  static subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.currentState, this.statusMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify(state: SyncState, message: string = '') {
    this.currentState = state;
    this.statusMessage = message;
    this.listeners.forEach((fn) => fn(state, message));
  }

  static getState(): { state: SyncState; message: string; needsSqlSetup: boolean } {
    return {
      state: this.currentState,
      message: this.statusMessage,
      needsSqlSetup: this.needsSqlSetup,
    };
  }

  /**
   * Initialize automatic listeners (online/offline, focus, heartbeat, realtime)
   * Protected with isInitialized flag so it is only setup once.
   */
  static init(onDataUpdated?: () => void) {
    if (typeof window === 'undefined') return;

    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    // 1. Online / Offline events
    window.addEventListener('online', () => {
      this.notify('SYNCING', 'Back online. Syncing pending data...');
      this.syncAll(onDataUpdated);
    });

    window.addEventListener('offline', () => {
      this.notify('OFFLINE', 'Offline. Changes saved locally, will sync when connected.');
    });

    // 2. Tab focus & visibility change (pull updates from other device)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.pullLatest(onDataUpdated);
      }
    });

    window.addEventListener('focus', () => {
      if (navigator.onLine) {
        this.pullLatest(onDataUpdated);
      }
    });

    // 3. Periodic heartbeat sync (every 10 seconds when online)
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.pullLatest(onDataUpdated);
        }
      }, 10000);
    }

    // 4. Initial sync after short delay
    setTimeout(() => {
      this.syncAll(onDataUpdated);
    }, 500);
  }

  /**
   * Subscribe to Supabase Realtime broadcast channel for instant multi-device pings
   */
  static setupRealtime(userId: string, onDataUpdated?: () => void) {
    if (!supabase || !userId) return;
    if (this.activeUserId === userId && this.realtimeChannel) return;

    try {
      this.activeUserId = userId;
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = supabase
        .channel(`cloud_sync_${userId}`, {
          config: { broadcast: { ack: false } },
        })
        .on('broadcast', { event: 'data_changed' }, async (payload: any) => {
          if (payload?.payload?.deviceId !== this.getDeviceId()) {
            console.log('Sync ping received from peer device. Refreshing...');
            await this.pullLatest(onDataUpdated);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime channel subscription error:', e);
    }
  }

  /**
   * Trigger full bidirectional sync (Pull then Push)
   */
  static async syncAll(onDataUpdated?: () => void) {
    if (!navigator.onLine) {
      this.notify('OFFLINE', 'Offline. Changes saved locally, will sync when connected.');
      return;
    }

    await this.pullLatest(onDataUpdated);
    await this.pushActivity(onDataUpdated);
  }

  /**
   * Push all local activity to the cloud
   */
  static async pushActivity(onDataUpdated?: () => void): Promise<boolean> {
    if (this.isSyncing) return false;
    if (!navigator.onLine) {
      this.notify('OFFLINE', 'Offline. Changes saved locally, will sync when connected.');
      return false;
    }

    const user = await AuthService.getCurrentUser();
    if (!user || !user.email) {
      this.notify('IDLE', 'Offline mode active');
      return false;
    }

    const accountId = await getAccountIdForEmail(user.email);

    this.isSyncing = true;
    this.notify('SYNCING', 'Syncing changes to cloud...');

    try {
      // Gather local data
      const companies = await db.companies.toArray();
      const vouchers = await db.vouchers.toArray();
      const ledgers = await db.ledgers.toArray();
      const ledgerGroups = await db.ledgerGroups.toArray();
      const stockItems = await db.stockItems.toArray();
      const godowns = await db.godowns.toArray();
      const bankAccounts = await db.bankAccounts.toArray();
      const employees = await db.employees.toArray();
      const salaryStructures = await db.salaryStructures.toArray();

      // Check if local vouchers are purely the default demo seed vouchers
      const isLocalOnlyDemoSeed =
        vouchers.length > 0 &&
        vouchers.every(
          (v) =>
            v.id === 'vch-sales-01' ||
            v.id === 'vch-sales-02' ||
            v.id === 'vch-pur-01' ||
            v.id === 'vch-pmt-01' ||
            v.id === 'vch-rct-01'
        );

      // Fetch existing cloud row to check if cloud already has real data
      const { data: existingRow, error: checkErr } = await supabase
        .from('user_sync_data')
        .select('data')
        .eq('user_id', accountId)
        .maybeSingle();

      if (checkErr && (checkErr.code === 'PGRST205' || checkErr.message?.includes('user_sync_data'))) {
        this.needsSqlSetup = true;
        this.notify('NEEDS_TABLE', 'Cloud database table needs 1-click SQL creation');
        this.isSyncing = false;
        return false;
      }

      // If cloud already has real vouchers, and local device only has demo seed vouchers,
      // DO NOT overwrite cloud with demo seed vouchers! Pull cloud data instead.
      if (isLocalOnlyDemoSeed && existingRow?.data?.vouchers?.length > 0) {
        const cloudHasNonSeed = existingRow.data.vouchers.some(
          (v: any) =>
            v.id !== 'vch-sales-01' &&
            v.id !== 'vch-sales-02' &&
            v.id !== 'vch-pur-01' &&
            v.id !== 'vch-pmt-01' &&
            v.id !== 'vch-rct-01'
        );
        if (cloudHasNonSeed) {
          this.isSyncing = false;
          await this.pullLatest(onDataUpdated);
          return true;
        }
      }

      const existingAccount = existingRow?.data?.account;

      const payload = {
        ...(existingAccount ? { account: existingAccount } : {}),
        deviceId: this.getDeviceId(),
        updatedAt: new Date().toISOString(),
        companies,
        vouchers,
        ledgers,
        ledgerGroups,
        stockItems,
        godowns,
        bankAccounts,
        employees,
        salaryStructures,
      };

      const { error } = await supabase.from('user_sync_data').upsert(
        {
          user_id: accountId,
          email: user.email.toLowerCase().trim(),
          data: payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('user_sync_data')) {
          this.needsSqlSetup = true;
          this.notify('NEEDS_TABLE', 'Cloud database table needs 1-click SQL creation');
        } else {
          this.notify('OFFLINE', 'Sync deferred: ' + error.message);
        }
        this.isSyncing = false;
        return false;
      }

      this.needsSqlSetup = false;
      this.notify('SYNCED', 'All changes synced to cloud');

      // Broadcast to other devices via Realtime
      if (this.realtimeChannel) {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'data_changed',
          payload: { deviceId: this.getDeviceId() },
        });
      }

      this.isSyncing = false;
      return true;
    } catch (err: any) {
      this.notify('OFFLINE', 'Offline or network issue');
      this.isSyncing = false;
      return false;
    }
  }

  /**
   * Pull latest data from cloud and merge cleanly into local IndexedDB
   */
  static async pullLatest(onDataUpdated?: () => void): Promise<boolean> {
    if (!navigator.onLine) {
      this.notify('OFFLINE', 'Offline. Changes saved locally, will sync when connected.');
      return false;
    }

    const user = await AuthService.getCurrentUser();
    if (!user || !user.email) return false;

    const accountId = await getAccountIdForEmail(user.email);

    try {
      const { data, error } = await supabase
        .from('user_sync_data')
        .select('data, updated_at')
        .eq('user_id', accountId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('user_sync_data')) {
          this.needsSqlSetup = true;
          this.notify('NEEDS_TABLE', 'Cloud database table needs 1-click SQL creation');
        }
        return false;
      }

      // If cloud has no snapshot yet, push this device's data to establish the baseline
      if (!data || !data.data) {
        await this.pushActivity(onDataUpdated);
        return true;
      }

      const cloud = data.data;

      // Read current local state
      const localVouchers = await db.vouchers.toArray();

      // Check if this device only has the unedited initial seed demo vouchers
      const isLocalOnlyDemoSeed =
        localVouchers.length > 0 &&
        localVouchers.every(
          (v) =>
            v.id === 'vch-sales-01' ||
            v.id === 'vch-sales-02' ||
            v.id === 'vch-pur-01' ||
            v.id === 'vch-pmt-01' ||
            v.id === 'vch-rct-01'
        );

      // Check for any newly created local vouchers that aren't demo vouchers and aren't in cloud
      const cloudVoucherIds = new Set((cloud.vouchers || []).map((v: any) => v.id));
      const newlyCreatedLocalVouchers = isLocalOnlyDemoSeed
        ? []
        : localVouchers.filter((lv) => !cloudVoucherIds.has(lv.id));

      // Build unified voucher set: Cloud snapshot + any offline vouchers created locally
      const unifiedVouchers = [...(cloud.vouchers || []), ...newlyCreatedLocalVouchers];

      // Overwrite local tables with cloud snapshot to guarantee 100% consistency across devices
      await db.transaction(
        'rw',
        [
          db.companies,
          db.vouchers,
          db.ledgers,
          db.ledgerGroups,
          db.stockItems,
          db.godowns,
          db.bankAccounts,
          db.employees,
          db.salaryStructures,
        ],
        async () => {
          if (cloud.companies && cloud.companies.length > 0) {
            await db.companies.clear();
            await db.companies.bulkPut(cloud.companies);
          }

          if (cloud.vouchers !== undefined) {
            await db.vouchers.clear();
            if (unifiedVouchers.length > 0) {
              await db.vouchers.bulkPut(unifiedVouchers);
            }
          }

          if (cloud.ledgers && cloud.ledgers.length > 0) {
            await db.ledgers.clear();
            await db.ledgers.bulkPut(cloud.ledgers);
          }

          if (cloud.ledgerGroups && cloud.ledgerGroups.length > 0) {
            await db.ledgerGroups.clear();
            await db.ledgerGroups.bulkPut(cloud.ledgerGroups);
          }

          if (cloud.stockItems && cloud.stockItems.length > 0) {
            await db.stockItems.clear();
            await db.stockItems.bulkPut(cloud.stockItems);
          }

          if (cloud.godowns && cloud.godowns.length > 0) {
            await db.godowns.clear();
            await db.godowns.bulkPut(cloud.godowns);
          }

          if (cloud.bankAccounts && cloud.bankAccounts.length > 0) {
            await db.bankAccounts.clear();
            await db.bankAccounts.bulkPut(cloud.bankAccounts);
          }

          if (cloud.employees && cloud.employees.length > 0) {
            await db.employees.clear();
            await db.employees.bulkPut(cloud.employees);
          }

          if (cloud.salaryStructures && cloud.salaryStructures.length > 0) {
            await db.salaryStructures.clear();
            await db.salaryStructures.bulkPut(cloud.salaryStructures);
          }
        }
      );

      this.needsSqlSetup = false;
      this.notify('SYNCED', 'All devices in sync');

      // If we merged offline local vouchers into the cloud, push back the combined state
      if (newlyCreatedLocalVouchers.length > 0) {
        await this.pushActivity(onDataUpdated);
      }

      if (onDataUpdated) {
        onDataUpdated();
      }

      return true;
    } catch (err: any) {
      console.warn('Pull from cloud skipped:', err);
      return false;
    }
  }
}
