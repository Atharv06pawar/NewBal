import { db } from './db';
import type { MasterAccount, SyncPayload, ConnectedDevice } from '@newbal/shared';

const API_BASE = 'http://localhost:4000/api';

export class SyncService {
  private static getDeviceId(): string {
    let devId = localStorage.getItem('newbal_device_id');
    if (!devId) {
      devId = `dev-${navigator.userAgent.includes('Mobile') ? 'mob' : 'desk'}-${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem('newbal_device_id', devId);
    }
    return devId;
  }

  private static getDeviceType(): 'DESKTOP' | 'MOBILE' | 'TABLET' | 'WEB' {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'TABLET';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) return 'MOBILE';
    return 'DESKTOP';
  }

  /**
   * Load or initialize Master Account from server or local cache
   */
  static async getMasterAccount(): Promise<MasterAccount> {
    const cached = localStorage.getItem('newbal_master_account');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }

    try {
      const res = await fetch(`${API_BASE}/auth/master`);
      if (res.ok) {
        const json = await res.json();
        if (json.account) {
          localStorage.setItem('newbal_master_account', JSON.stringify(json.account));
          return json.account;
        }
      }
    } catch (err) {
      // Offline fallback
    }

    // Default Fallback Master Account
    const defaultAccount: MasterAccount = {
      id: 'acc-master-01',
      email: 'owner@apexinnovations.in',
      fullName: 'Business Owner',
      businessName: 'Apex Innovations Pvt. Ltd.',
      syncPairCode: 'NB-7721',
      plan: 'LIFETIME_FREE',
      connectedDevices: [
        {
          id: this.getDeviceId(),
          name: navigator.userAgent.includes('Mobile') ? 'Mobile Device (PWA)' : 'Primary Desktop (Windows)',
          type: this.getDeviceType(),
          lastActive: new Date().toISOString(),
          isCurrent: true,
        },
      ],
      lastSyncedAt: new Date().toISOString(),
      autoSyncEnabled: true,
    };

    localStorage.setItem('newbal_master_account', JSON.stringify(defaultAccount));
    return defaultAccount;
  }

  /**
   * Pair another device using the 6-digit syncPairCode (e.g. "NB-7721")
   */
  static async pairDeviceWithCode(pairCode: string, deviceName?: string): Promise<{ success: boolean; message: string; account?: MasterAccount }> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairCode,
          deviceName: deviceName || (navigator.userAgent.includes('Mobile') ? 'Linked Mobile Phone' : 'Linked Secondary PC'),
          deviceType: this.getDeviceType(),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        return { success: false, message: json.error || 'Failed to link device with pair code' };
      }

      localStorage.setItem('newbal_master_account', JSON.stringify(json.account));
      if (json.deviceId) {
        localStorage.setItem('newbal_device_id', json.deviceId);
      }

      // If server returned sync data, restore it into local DB
      if (json.latestSyncData) {
        await this.applySyncPayload(json.latestSyncData);
      }

      return { success: true, message: 'Device successfully paired to single master account!', account: json.account };
    } catch (err) {
      return { success: false, message: 'Network error connecting to sync server' };
    }
  }

  /**
   * Push all local data from this device to the Master Account Cloud
   */
  static async pushToCloud(account: MasterAccount): Promise<boolean> {
    try {
      const payload: SyncPayload = {
        accountId: account.id,
        deviceId: this.getDeviceId(),
        timestamp: new Date().toISOString(),
        companies: await db.companies.toArray(),
        ledgerGroups: await db.ledgerGroups.toArray(),
        ledgers: await db.ledgers.toArray(),
        vouchers: await db.vouchers.toArray(),
        stockGroups: await db.stockGroups.toArray(),
        stockItems: await db.stockItems.toArray(),
        godowns: await db.godowns.toArray(),
        unitsOfMeasure: await db.unitsOfMeasure.toArray(),
        employees: await db.employees.toArray(),
        salaryStructures: await db.salaryStructures.toArray(),
        bankAccounts: await db.bankAccounts.toArray(),
      };

      const res = await fetch(`${API_BASE}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        account.lastSyncedAt = new Date().toISOString();
        localStorage.setItem('newbal_master_account', JSON.stringify(account));
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Sync push deferred (offline or server disconnected)');
      return false;
    }
  }

  /**
   * Pull latest data from the Master Account Cloud to this device
   */
  static async pullFromCloud(account: MasterAccount): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/sync/pull/${account.id}`);
      if (!res.ok) return false;

      const json = await res.json();
      if (json.data) {
        await this.applySyncPayload(json.data);
        account.lastSyncedAt = new Date().toISOString();
        localStorage.setItem('newbal_master_account', JSON.stringify(account));
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Sync pull deferred (offline or server disconnected)');
      return false;
    }
  }

  /**
   * Apply sync payload into local IndexedDB
   */
  private static async applySyncPayload(data: SyncPayload) {
    await db.transaction('rw', [
      db.companies,
      db.ledgerGroups,
      db.ledgers,
      db.vouchers,
      db.stockGroups,
      db.stockItems,
      db.godowns,
      db.unitsOfMeasure,
      db.employees,
      db.salaryStructures,
      db.bankAccounts,
    ], async () => {
      if (data.companies?.length) await db.companies.bulkPut(data.companies);
      if (data.ledgerGroups?.length) await db.ledgerGroups.bulkPut(data.ledgerGroups);
      if (data.ledgers?.length) await db.ledgers.bulkPut(data.ledgers);
      if (data.vouchers?.length) await db.vouchers.bulkPut(data.vouchers);
      if (data.stockGroups?.length) await db.stockGroups.bulkPut(data.stockGroups);
      if (data.stockItems?.length) await db.stockItems.bulkPut(data.stockItems);
      if (data.godowns?.length) await db.godowns.bulkPut(data.godowns);
      if (data.unitsOfMeasure?.length) await db.unitsOfMeasure.bulkPut(data.unitsOfMeasure);
      if (data.employees?.length) await db.employees.bulkPut(data.employees);
      if (data.salaryStructures?.length) await db.salaryStructures.bulkPut(data.salaryStructures);
      if (data.bankAccounts?.length) await db.bankAccounts.bulkPut(data.bankAccounts);
    });
  }
}
