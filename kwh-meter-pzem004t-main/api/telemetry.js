/**
 * Telemetry Ingestion HTTP Transport Adapter
 * POST /api/telemetry
 */

import { ingestTelemetryBatch } from '../lib/ingestion.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];

  try {
    const result = await ingestTelemetryBatch(req.body, token);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.code || 'SERVER_ERROR',
      message: err.message,
      details: err.details
    });
  }
}
