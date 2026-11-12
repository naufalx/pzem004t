import test from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import server from '../server.js';

const PORT = 3999;
const BASE_URL = `http://localhost:${PORT}`;
const DEVICE_ID = `e2e-test-${Date.now()}`;
const DEVICE_TOKEN = 'c8f93e2b1049a8d7e6f5c4b3a2918273645e4d3c2b1a0987f6e5d4c3b2a10987';

test('E2E Integration: End-to-end ingestion, deduplication, validation, and querying', async (t) => {
  // 1. Start server on isolated port
  await new Promise(resolve => server.listen(PORT, resolve));

  t.after(async () => {
    try {
      const { getDatabase } = await import('../lib/firebase.js');
      const { db } = getDatabase();
      await Promise.all([
        db.ref(`devices/${DEVICE_ID}`).remove(),
        db.ref(`summaries/${DEVICE_ID}`).remove()
      ]);
    } catch (_) {}
    server.close();
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app.delete()));
    }
  });

  const batchId = `e2e-batch-${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);

  const testPayload = {
    deviceId: DEVICE_ID,
    batchId,
    firmwareVersion: '2.0.0-test',
    sentAt: now,
    records: [
      {
        timestamp: now - 4,
        sequence: 2001,
        voltage: 221.0,
        current: 1.5,
        powerFactor: 0.95,
        activePower: 315.0,
        energy: 15.000,
        frequency: 50.0
      },
      {
        timestamp: now,
        sequence: 2002,
        voltage: 221.5,
        current: 2.0,
        powerFactor: 0.95,
        activePower: 420.8,
        energy: 15.001,
        frequency: 50.0
      }
    ]
  };

  // Test 1: Ingestion with valid token -> HTTP 200
  const ingestRes = await fetch(`${BASE_URL}/api/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEVICE_TOKEN}`,
      'x-device-id': DEVICE_ID
    },
    body: JSON.stringify(testPayload)
  });

  assert.equal(ingestRes.status, 200);
  const ingestData = await ingestRes.json();
  assert.equal(ingestData.success, true);
  assert.equal(ingestData.recordsCount, 2);

  // Test 2: Deduplication: re-sending same batchId -> HTTP 200 with duplicate flag
  const dupRes = await fetch(`${BASE_URL}/api/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEVICE_TOKEN}`
    },
    body: JSON.stringify(testPayload)
  });

  assert.equal(dupRes.status, 200);
  const dupData = await dupRes.json();
  assert.equal(dupData.duplicate, true);

  // Test 3: Unauthorized rejection -> HTTP 401
  const unauthRes = await fetch(`${BASE_URL}/api/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer wrong-token'
    },
    body: JSON.stringify(testPayload)
  });
  assert.equal(unauthRes.status, 401);

  // Test 4: Validation rejection on NaN -> HTTP 400
  const badPayload = {
    ...testPayload,
    batchId: `bad-${Date.now()}`,
    records: [{ ...testPayload.records[0], voltage: NaN }]
  };
  const badRes = await fetch(`${BASE_URL}/api/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEVICE_TOKEN}`
    },
    body: JSON.stringify(badPayload)
  });
  assert.equal(badRes.status, 400);

  // Test 5: Query device status -> online
  const statusRes = await fetch(`${BASE_URL}/api/device/status?deviceId=${DEVICE_ID}`);
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.online, true);
  assert.equal(statusData.firmwareVersion, '2.0.0-test');

  // Test 6: Query history records
  const histRes = await fetch(`${BASE_URL}/api/history?deviceId=${DEVICE_ID}&limit=10`);
  assert.equal(histRes.status, 200);
  const histData = await histRes.json();
  assert.ok(histData.count >= 2);
  assert.equal(histData.records[0].voltage, 221.5);

  // Test 7: Query summary
  const sumRes = await fetch(`${BASE_URL}/api/summary?deviceId=${DEVICE_ID}`);
  assert.equal(sumRes.status, 200);
  const sumData = await sumRes.json();
  assert.ok(sumData.today.peakPower >= 420.0);
  assert.equal(sumData.cumulativeEnergy, 15.001);
});
