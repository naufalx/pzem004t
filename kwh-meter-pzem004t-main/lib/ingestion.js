/**
 * Deep Ingestion Core Module
 * Encapsulates authentication, boundary validation, deduplication,
 * delta energy calculations, and atomic database persistence.
 */

import dotenv from 'dotenv';
import { validateBatchPayload } from './validator.js';
import { getJakartaDateKey, getJakartaMonthKey, updateDailySummary } from './analytics.js';
import { getDatabase } from './firebase.js';

dotenv.config();

export class IngestionError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Ingests a validated telemetry batch into the data store.
 * @param {object} payload - Batch payload from physical ESP32 or Mock Simulator
 * @param {string} authToken - Bearer or header device token
 * @returns {Promise<object>} Processing outcome with batchId and recordsCount
 */
export async function ingestTelemetryBatch(payload, authToken) {
  // 1. Device Authentication
  const expectedToken = process.env.DEVICE_TOKEN || 'c8f93e2b1049a8d7e6f5c4b3a2918273645e4d3c2b1a0987f6e5d4c3b2a10987';
  if (!authToken || authToken !== expectedToken) {
    throw new IngestionError(401, 'UNAUTHORIZED', 'Invalid or missing device authentication token');
  }

  // 2. Strict Boundary & Structure Validation
  const validation = validateBatchPayload(payload);
  if (!validation.valid) {
    throw new IngestionError(400, 'VALIDATION_FAILED', validation.error, validation.details);
  }

  const { deviceId, batchId, firmwareVersion, records } = payload;
  const { db } = getDatabase();

  // 3. Idempotent Deduplication Check
  const batchRef = db.ref(`summaries/${deviceId}/processedBatches/${batchId}`);
  const batchSnap = await batchRef.once('value');
  if (batchSnap.exists()) {
    return {
      success: true,
      duplicate: true,
      message: 'Batch already processed; skipped redundant insertion',
      batchId
    };
  }

  // 4. Sort and Extract Telemetry
  const sortedRecords = [...records].sort((a, b) => a.sequence - b.sequence);
  const latestRecord = sortedRecords[sortedRecords.length - 1];
  const serverTime = Math.floor(Date.now() / 1000);

  // Multi-path atomic database update
  const updates = {};

  // 4.1 Update Latest State
  updates[`devices/${deviceId}/latest`] = {
    ...latestRecord,
    serverReceivedAt: serverTime
  };

  // 4.2 Update Device Status Heartbeat
  updates[`devices/${deviceId}/status`] = {
    online: true,
    lastSeen: serverTime,
    firmwareVersion,
    lastBatchId: batchId
  };

  // 4.3 Append History Records
  for (const r of sortedRecords) {
    const dateKey = getJakartaDateKey(r.timestamp);
    const recordKey = `${r.timestamp}_${String(r.sequence).padStart(6, '0')}`;
    updates[`history/${deviceId}/${dateKey}/${recordKey}`] = {
      v: r.voltage,
      i: r.current,
      p: r.activePower,
      pf: r.powerFactor,
      e: r.energy,
      f: r.frequency,
      t: r.timestamp,
      seq: r.sequence
    };
  }

  // 4.4 Mark Batch Processed
  updates[`summaries/${deviceId}/processedBatches/${batchId}`] = serverTime;

  // Execute batch writes
  await db.ref().update(updates);

  // 4.5 Update Daily and Monthly Summaries
  const dateKey = getJakartaDateKey(latestRecord.timestamp);
  const monthKey = getJakartaMonthKey(latestRecord.timestamp);
  const dailyRef = db.ref(`summaries/${deviceId}/daily/${dateKey}`);
  const dailySnap = await dailyRef.once('value');
  const existingDaily = dailySnap.val();

  const tariff = parseFloat(process.env.DEFAULT_TARIFF_PER_KWH || '1444.70');
  const updatedDaily = updateDailySummary(existingDaily, sortedRecords, tariff);

  await dailyRef.set(updatedDaily);

  // Update monthly delta
  const monthlyRef = db.ref(`summaries/${deviceId}/monthly/${monthKey}`);
  const monthlySnap = await monthlyRef.once('value');
  const existingMonthly = monthlySnap.val() || {
    month: monthKey,
    totalKwh: 0,
    totalCost: 0,
    peakPower: 0,
    daysRecorded: 0
  };

  const deltaKwhThisBatch = (updatedDaily.deltaEnergy || 0) - (existingDaily?.deltaEnergy || 0);
  const updatedMonthly = {
    month: monthKey,
    totalKwh: Number(((existingMonthly.totalKwh || 0) + Math.max(0, deltaKwhThisBatch)).toFixed(3)),
    totalCost: Number(((existingMonthly.totalCost || 0) + Math.max(0, deltaKwhThisBatch * tariff)).toFixed(2)),
    peakPower: Math.max(existingMonthly.peakPower || 0, updatedDaily.peakPower || 0),
    lastUpdated: serverTime
  };
  await monthlyRef.set(updatedMonthly);

  return {
    success: true,
    message: 'Batch processed successfully',
    batchId,
    recordsCount: sortedRecords.length,
    serverTime
  };
}
