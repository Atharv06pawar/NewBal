import { db } from './db';
import { supabase, isSupabaseConfigured, AuthService, type AuthUserProfile } from './supabase';
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
  private static needsSqlSetup = false;

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
   */
  static init(onDataUpdated?: () => void) {
    if (typeof window === 'undefined') return;

    // 1. Online / Offline events
    window.addEventListener('online', () => {
      this.notify('SYNCING', 'Back online. Syncing pending data...');
      this.syncAll(onDataUpdated);
    });

    window.addEventListener('offline', () => {
      this.notify('OFFLINE', 'No internet connection. Changes saved locally.');
    });

    // 2. Focus & Tab visibility change (pull updates from other device)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullLatest(onDataUpdated);
      }
    });

    window.addEventListener('focus', () => {
      this.pullLatest(onDataUpdated);
    });

    // 3. Periodic heartbeat sync (every 20 seconds)
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        if (navigator.onLine) {
          this.pullLatest(onDataUpdated);
        }
      }, 20000);
    }

    // 4. Initial sync
    setTimeout(() => {
      this.syncAll(onDataUpdated);
    }, 1000);
  }

  /**
   * Subscribe to Supabase Realtime broadcast channel for instant multi-device pings
   */
  static setupRealtime(userId: string, onDataUpdated?: () => void) {
    if (!supabase || !userId) return;

    try {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
      }

      this.realtimeChannel = supabase
        .channel(`cloud_sync_${userId}`)
        .on('broadcast', { event: 'data_changed' }, (payload: any) => {
          if (payload?.payload?.deviceId !== this.getDeviceId()) {
            // Change came from another device! Pull immediately
            this.pullLatest(onDataUpdated);
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
      this.notify('OFFLINE', 'Offline. Changes saved locally.');
      return;
    }

    await this.pullLatest(onDataUpdated);
    await this.pushActivity();
  }

  /**
   * Push all local activity to the cloud
   */
  static async pushActivity(): Promise<boolean> {
    if (this.isSyncing) return false;
    if (!navigator.onLine) {
      this.notify('OFFLINE', 'Offline. Changes saved locally.');
      return false;
    }

    const user = await AuthService.getCurrentUser();
    if (!user || !supabase) {
      this.notify('IDLE', 'Local storage active');
      return false;
    }

    this.isSyncing = true;
    this.notify('SYNCING', 'Syncing changes to cloud...');

    try {
      // Gather all local data
      const companies = await db.companies.toArray();
      const vouchers = await db.vouchers.toArray();
      const ledgers = await db.ledgers.toArray();
      const ledgerGroups = await db.ledgerGroups.toArray();
      const stockItems = await db.stockItems.toArray();
      const godowns = await db.godowns.toArray();
      const bankAccounts = await db.bankAccounts.toArray();
      const employees = await db.employees.toArray();
      const salaryStructures = await db.salaryStructures.toArray();

      const payload = {
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
          user_id: user.id,
          email: user.email,
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
      this.notify('OFFLINE', 'Offline. Changes saved locally.');
      return false;
    }

    const user = await AuthService.getCurrentUser();
    if (!user || !supabase) return false;

    try {
      const { data, error } = await supabase
        .from('user_sync_data')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('user_sync_data')) {
          this.needsSqlSetup = true;
          this.notify('NEEDS_TABLE', 'Cloud database table needs 1-click SQL creation');
        }
        return false;
      }

      if (!data || !data.data) {
        // No cloud snapshot yet. Push our current local data to establish cloud baseline!
        await this.pushActivity();
        return true;
      }

      const cloud = data.data;
      let hasNewRecords = false;

      // Conflict-Free Merge: Union by ID with Last-Write-Wins
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
          // 1. Vouchers merge
          if (cloud.vouchers?.length) {
            const localVouchers = await db.vouchers.toArray();
            const localMap = new Map(localVouchers.map((v) => [v.id, v]));

            for (const cv of cloud.vouchers) {
              const lv = localMap.get(cv.id);
              if (!lv) {
                await db.vouchers.put(cv);
                hasNewRecords = true;
              } else if (new Date(cv.updatedAt || cv.createdAt || 0) > new Date(lv.updatedAt || lv.createdAt || 0)) {
                await db.vouchers.put(cv);
                hasNewRecords = true;
              }
            }
          }

          // 2. Companies merge
          if (cloud.companies?.length) {
            for (const cc of cloud.companies) {
              await db.companies.put(cc);
            }
          }

          // 3. Ledgers merge
          if (cloud.ledgers?.length) {
            const localLeds = await db.ledgers.toArray();
            const localLedMap = new Map(localLeds.map((l) => [l.id, l]));
            for (const cl of cloud.ledgers) {
              if (!localLedMap.has(cl.id)) {
                await db.ledgers.put(cl);
                hasNewRecords = true;
              }
            }
          }

          // 4. Inventory items merge
          if (cloud.stockItems?.length) {
            for (const item of cloud.stockItems) {
              await db.stockItems.put(item);
            }
          }

          // 5. Bank Accounts merge
          if (cloud.bankAccounts?.length) {
            for (const ba of cloud.bankAccounts) {
              await db.bankAccounts.put(ba);
            }
          }
        }
      );

      this.needsSqlSetup = false;
      this.notify('SYNCED', 'Up to date with cloud');

      if (hasNewRecords && onDataUpdated) {
        onDataUpdated();
      }

      return true;
    } catch (err: any) {
      console.warn('Pull from cloud skipped:', err);
      return false;
    }
  }
}
