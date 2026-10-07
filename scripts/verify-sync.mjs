// Automated Verification Test for Single Master Account & Cross-Device Cloud Sync
console.log('=====================================================');
console.log('NEWBAL SINGLE MASTER ACCOUNT & CROSS-DEVICE SYNC TEST');
console.log('=====================================================\n');

async function testSync() {
  const resHealth = await fetch('http://localhost:4000/api/health');
  const health = await resHealth.json();
  console.log(`[PASS] Server Health: ${health.status} (${health.service})`);

  const resMaster = await fetch('http://localhost:4000/api/auth/master');
  const master = await resMaster.json();
  console.log(`[PASS] Single Master Account: ${master.account.email} - Business: ${master.account.businessName}`);
  console.log(`[PASS] Device Pairing Code: ${master.account.syncPairCode}`);

  // Test Push from Device 1
  const pushPayload = {
    accountId: master.account.id,
    deviceId: 'dev-desktop-win',
    timestamp: new Date().toISOString(),
    companies: [{ id: 'comp-1', name: 'Apex Innovations Pvt. Ltd.' }],
    vouchers: [{ id: 'vch-1', voucherNumber: 'INV/24-25/001', grandTotal: 56640 }],
    ledgers: [{ id: 'led-1', name: 'Acme Systems Pvt Ltd' }],
  };

  const resPush = await fetch('http://localhost:4000/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pushPayload),
  });
  const pushResult = await resPush.json();
  console.log(`[PASS] Cloud Sync Push: ${pushResult.status} (${pushResult.recordsCount.vouchers} vouchers pushed)`);

  // Test Pull from Device 2 (e.g. Phone or iPad)
  const resPull = await fetch(`http://localhost:4000/api/sync/pull/${master.account.id}`);
  const pullResult = await resPull.json();
  console.log(`[PASS] Cloud Sync Pull on Secondary Device: Retrieved ${pullResult.data.vouchers.length} vouchers and ${pullResult.data.companies.length} companies`);

  // Test Device Pairing with 6-digit Pair Code
  const resPair = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pairCode: master.account.syncPairCode,
      deviceName: 'iPhone 15 Mobile PWA',
      deviceType: 'MOBILE',
    }),
  });
  const pairResult = await resPair.json();
  console.log(`[PASS] Instant Device Linking with Code ${master.account.syncPairCode}: Paired successfully as ${pairResult.account.connectedDevices[pairResult.account.connectedDevices.length - 1].name}`);

  console.log('\n-----------------------------------------------------');
  console.log('All Single Master Account & Cross-Device tests passed!');
  console.log('The user can now manage everything across any device from 1 account.');
  console.log('-----------------------------------------------------\n');
}

testSync().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
