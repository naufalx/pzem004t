/**
 * Reset Device Database Serverless Handler
 * POST /api/device/reset-database
 */

import { resetDeviceDatabase } from '../../lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const deviceId = req.body?.deviceId || req.query?.deviceId || process.env.DEVICE_ID || 'kwh-meter-001';

  try {
    const result = await resetDeviceDatabase(deviceId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
