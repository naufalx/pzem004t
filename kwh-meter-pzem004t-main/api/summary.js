/**
 * Energy Summary HTTP Transport Adapter
 * GET /api/summary
 */

import { getEnergySummary } from '../lib/storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const deviceId = req.query.deviceId || process.env.DEVICE_ID || 'kwh-meter-001';

  try {
    const summary = await getEnergySummary(deviceId);
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
