import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MasterAccount, SyncPayload, ConnectedDevice } from '@newbal/shared';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Local Data Persistence Directory (100% Free, zero cloud cost, persistent)
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SYNC_DATA_FILE = path.join(DATA_DIR, 'sync_data.json');

interface AccountRecord {
  account: MasterAccount;
  passwordHash: string;
}

// In-memory cache loaded from disk
let accountsMap = new Map<string, AccountRecord>();
let syncStore = new Map<string, SyncPayload>();

function loadFromDisk() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
      accountsMap = new Map(Object.entries(data));
    } else {
      // Default initial master account for instant out-of-the-box cross-device usage
      const defaultAccount: MasterAccount = {
        id: 'acc-master-01',
        email: 'owner@apexinnovations.in',
        fullName: 'Business Owner',
        businessName: 'Apex Innovations Pvt. Ltd.',
        syncPairCode: 'NB-7721',
        plan: 'LIFETIME_FREE',
        connectedDevices: [
          {
            id: 'dev-primary-01',
            name: 'Primary Desktop (Windows)',
            type: 'DESKTOP',
            lastActive: new Date().toISOString(),
            isCurrent: true,
          },
        ],
        lastSyncedAt: new Date().toISOString(),
        autoSyncEnabled: true,
      };
      accountsMap.set(defaultAccount.id, {
        account: defaultAccount,
        passwordHash: 'admin123',
      });
      saveToDisk();
    }

    if (fs.existsSync(SYNC_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(SYNC_DATA_FILE, 'utf-8'));
      syncStore = new Map(Object.entries(data));
    }
  } catch (err) {
    console.error('Error loading data from disk:', err);
  }
}

function saveToDisk() {
  try {
    const accObj = Object.fromEntries(accountsMap.entries());
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accObj, null, 2), 'utf-8');

    const syncObj = Object.fromEntries(syncStore.entries());
    fs.writeFileSync(SYNC_DATA_FILE, JSON.stringify(syncObj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data to disk:', err);
  }
}

loadFromDisk();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'NEWBAL Universal Cloud Sync Engine',
    version: '1.0.0',
    mode: 'SINGLE_ACCOUNT_CROSS_DEVICE',
    timestamp: new Date().toISOString(),
  });
});

// 1. Get or Create Master Account
app.get('/api/auth/master', (req, res) => {
  const first = Array.from(accountsMap.values())[0];
  if (first) {
    res.json({ account: first.account });
  } else {
    res.status(404).json({ error: 'No account found' });
  }
});

// 2. Register / Update Master Account
app.post('/api/auth/register', (req, res) => {
  const { email, fullName, businessName, password, deviceName, deviceType } = req.body;

  // Check if exists
  let existing = Array.from(accountsMap.values()).find((a) => a.account.email === email);
  if (!existing) {
    const accountId = `acc-${Date.now()}`;
    const pairCode = `NB-${Math.floor(1000 + Math.random() * 9000)}`;

    const device: ConnectedDevice = {
      id: `dev-${Date.now()}`,
      name: deviceName || 'Primary Device',
      type: deviceType || 'DESKTOP',
      lastActive: new Date().toISOString(),
      isCurrent: true,
    };

    const newAccount: MasterAccount = {
      id: accountId,
      email: email || 'user@newbal.app',
      fullName: fullName || 'Account Owner',
      businessName: businessName || 'Enterprise Business',
      syncPairCode: pairCode,
      plan: 'LIFETIME_FREE',
      connectedDevices: [device],
      lastSyncedAt: new Date().toISOString(),
      autoSyncEnabled: true,
    };

    accountsMap.set(accountId, {
      account: newAccount,
      passwordHash: password || '123456',
    });
    saveToDisk();

    res.json({ status: 'CREATED', account: newAccount, deviceId: device.id });
  } else {
    res.json({ status: 'EXISTS', account: existing.account });
  }
});

// 3. Login or Pair from another device using email/password or 6-digit syncPairCode!
app.post('/api/auth/login', (req, res) => {
  const { email, password, pairCode, deviceName, deviceType } = req.body;

  let matchedRecord: AccountRecord | undefined;

  if (pairCode) {
    // Quick-link via 6-digit pair code (Instant device linking!)
    matchedRecord = Array.from(accountsMap.values()).find(
      (a) => a.account.syncPairCode.toUpperCase() === pairCode.trim().toUpperCase()
    );
  } else if (email) {
    matchedRecord = Array.from(accountsMap.values()).find(
      (a) => a.account.email.toLowerCase() === email.toLowerCase() && a.passwordHash === password
    );
  }

  if (!matchedRecord) {
    return res.status(401).json({ error: 'Invalid credentials or pair code' });
  }

  // Register the new device under this single master account
  const newDevice: ConnectedDevice = {
    id: `dev-${Date.now()}`,
    name: deviceName || (pairCode ? 'Paired Mobile / Web Client' : 'Connected Browser'),
    type: deviceType || 'MOBILE',
    lastActive: new Date().toISOString(),
    isCurrent: true,
  };

  // Add device if not already present
  matchedRecord.account.connectedDevices = [
    ...matchedRecord.account.connectedDevices.filter((d) => d.id !== newDevice.id),
    newDevice,
  ];
  matchedRecord.account.lastSyncedAt = new Date().toISOString();
  saveToDisk();

  res.json({
    status: 'AUTHENTICATED',
    account: matchedRecord.account,
    deviceId: newDevice.id,
    latestSyncData: syncStore.get(matchedRecord.account.id) || null,
  });
});

// 4. Push Local State to Master Account Cloud Store
app.post('/api/sync/push', (req, res) => {
  const payload: SyncPayload = req.body;
  if (!payload || !payload.accountId) {
    return res.status(400).json({ error: 'Invalid sync payload' });
  }

  syncStore.set(payload.accountId, {
    ...payload,
    timestamp: new Date().toISOString(),
  });

  // Update account last synced time
  const accRecord = accountsMap.get(payload.accountId);
  if (accRecord) {
    accRecord.account.lastSyncedAt = new Date().toISOString();
    // Update active device timestamp
    const dev = accRecord.account.connectedDevices.find((d) => d.id === payload.deviceId);
    if (dev) {
      dev.lastActive = new Date().toISOString();
    }
  }

  saveToDisk();

  res.json({
    status: 'SYNCED',
    timestamp: new Date().toISOString(),
    recordsCount: {
      companies: payload.companies?.length || 0,
      vouchers: payload.vouchers?.length || 0,
      ledgers: payload.ledgers?.length || 0,
      stockItems: payload.stockItems?.length || 0,
      employees: payload.employees?.length || 0,
    },
  });
});

// 5. Pull Master Account State to Any Device
app.get('/api/sync/pull/:accountId', (req, res) => {
  const { accountId } = req.params;
  const data = syncStore.get(accountId);

  if (!data) {
    return res.json({ status: 'EMPTY', data: null });
  }

  res.json({
    status: 'SUCCESS',
    data,
    timestamp: data.timestamp,
  });
});

// 6. Device Pairing & Status
app.get('/api/account/:accountId/devices', (req, res) => {
  const { accountId } = req.params;
  const accRecord = accountsMap.get(accountId);

  if (!accRecord) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({
    devices: accRecord.account.connectedDevices,
    pairCode: accRecord.account.syncPairCode,
    lastSyncedAt: accRecord.account.lastSyncedAt,
  });
});

app.listen(PORT, () => {
  console.log(`[NEWBAL Server] Single Master Account & Cross-Device Cloud Sync running on http://localhost:${PORT}`);
});
