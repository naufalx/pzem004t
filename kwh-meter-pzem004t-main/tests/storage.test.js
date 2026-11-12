import { test } from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import { getDeviceStatus, getHistoryRecords, formatRecordsAsCsv, getEnergySummary, resetDeviceDatabase } from '../lib/storage.js';
import { IngestionError, ingestTelemetryBatch } from '../lib/ingestion.js';

test('Storage Module: getDeviceStatus returns status object', async () => {
  const status = await getDeviceStatus('kwh-meter-001');
  assert.ok(status);
  assert.strictEqual(status.success, true);
  assert.strictEqual(status.deviceId, 'kwh-meter-001');
  assert.strictEqual(typeof status.online, 'boolean');
});

test('Storage Module: formatRecordsAsCsv outputs semicolon-delimited CSV with UTF-8 BOM', () => {
  const mockRecords = [
    {
      timeString: '03/11/2026, 20.30.00',
      timestamp: 1730640600,
      sequence: 101,
      voltage: 220.5,
      current: 1.25,
      activePower: 260.0,
      powerFactor: 0.95,
      energy: 10.500,
      frequency: 50.0
    }
  ];

  const csv = formatRecordsAsCsv(mockRecords, 'kwh-meter-001', '2026-11-03');
  assert.ok(csv.startsWith('\uFEFF# LAPORAN TELEMETRI'));
  assert.ok(csv.includes('Tegangan (V)'));
  assert.ok(csv.includes('220.5;1.25;260.0;0.95;50.0;10.500;101'));
});

test('Storage Module: resetDeviceDatabase purges device records cleanly', async () => {
  const res = await resetDeviceDatabase('kwh-meter-001');
  assert.ok(res);
  assert.strictEqual(res.success, true);
  assert.ok(res.message.includes('kwh-meter-001'));
});

test('Ingestion Module: rejects invalid token with IngestionError 401', async (t) => {
  t.after(async () => {
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app.delete()));
    }
  });

  await assert.rejects(
    async () => {
      await ingestTelemetryBatch({}, 'wrong-token');
    },
    (err) => {
      assert.ok(err instanceof IngestionError);
      assert.strictEqual(err.status, 401);
      assert.strictEqual(err.code, 'UNAUTHORIZED');
      return true;
    }
  );
});
