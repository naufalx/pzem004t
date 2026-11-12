/**
 * Telemetry History HTTP Transport Adapter
 * GET /api/history
 */

import { getHistoryRecords, formatRecordsAsCsv, resetDeviceDatabase } from '../lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const deviceId = req.query.deviceId || process.env.DEVICE_ID || 'kwh-meter-001';

  if (req.method === 'DELETE') {
    try {
      const result = await resetDeviceDatabase(deviceId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  const date = req.query.date || null;
  const limit = req.query.limit || 500;
  const format = req.query.format || 'json';

  try {
    const result = await getHistoryRecords(deviceId, date, limit);

    if (format === 'csv') {
      const csv = formatRecordsAsCsv(result.records, deviceId, result.date);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=riwayat_${deviceId}_${result.date}.csv`);
      return res.status(200).send(csv);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
