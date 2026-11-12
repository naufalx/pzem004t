import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBatchPayload, validateRecord, BOUNDS } from '../lib/validator.js';

test('Validator: accepts well-formed valid record', () => {
  const record = {
    timestamp: 1793600000,
    sequence: 1001,
    voltage: 220.5,
    current: 1.25,
    powerFactor: 0.95,
    activePower: 261.8,
    energy: 12.45,
    frequency: 50.0
  };

  const err = validateRecord(record, 0);
  assert.equal(err, null, 'Expected valid record to have no errors');
});

test('Validator: strictly rejects NaN and Infinity', () => {
  const nanRecord = {
    timestamp: 1793600000,
    sequence: 1001,
    voltage: NaN,
    current: 1.25,
    powerFactor: 0.95,
    activePower: 250.0,
    energy: 12.45,
    frequency: 50.0
  };
  const errNaN = validateRecord(nanRecord, 0);
  assert.match(errNaN, /must be a finite number/, 'Should reject NaN');

  const infRecord = { ...nanRecord, voltage: Infinity };
  const errInf = validateRecord(infRecord, 0);
  assert.match(errInf, /must be a finite number/, 'Should reject Infinity');
});

test('Validator: rejects out-of-bounds physical values', () => {
  const lowVoltage = {
    timestamp: 1793600000,
    sequence: 1001,
    voltage: 45.0, // Minimum is 80V
    current: 1.0,
    powerFactor: 0.9,
    activePower: 100.0,
    energy: 10.0,
    frequency: 50.0
  };
  assert.match(validateRecord(lowVoltage, 0), /outside physical bounds/);

  const negCurrent = { ...lowVoltage, voltage: 220.0, current: -2.0 };
  assert.match(validateRecord(negCurrent, 0), /outside physical bounds/);

  const highPf = { ...lowVoltage, voltage: 220.0, powerFactor: 1.2 };
  assert.match(validateRecord(highPf, 0), /outside physical bounds/);
});

test('Validator: validates batch payload structure', () => {
  const validBatch = {
    deviceId: 'kwh-meter-001',
    batchId: 'test-batch-001',
    firmwareVersion: '2.0.0',
    records: [
      {
        timestamp: 1793600001,
        sequence: 1001,
        voltage: 220.5,
        current: 1.25,
        powerFactor: 0.95,
        activePower: 261.8,
        energy: 12.45,
        frequency: 50.0
      }
    ]
  };

  const res = validateBatchPayload(validBatch);
  assert.equal(res.valid, true);

  // Missing deviceId
  const noDevice = { ...validBatch, deviceId: '' };
  assert.equal(validateBatchPayload(noDevice).valid, false);

  // Empty records
  const noRecords = { ...validBatch, records: [] };
  assert.equal(validateBatchPayload(noRecords).valid, false);

  // Oversized batch (>50)
  const hugeBatch = {
    ...validBatch,
    records: Array(55).fill(validBatch.records[0])
  };
  assert.match(validateBatchPayload(hugeBatch).error, /exceeds maximum batch size/);
});
