/**
 * Deep Data Query & Storage Layer
 * Centralizes read access to device state, telemetry history, and energy summaries.
 */

import { getDatabase } from './firebase.js';
import { getJakartaDateKey, getJakartaMonthKey } from './analytics.js';

/**
 * Retrieves real-time connectivity status of a device.
 */
export async function getDeviceStatus(deviceId = 'kwh-meter-001') {
  const { db } = getDatabase();
  const snap = await db.ref(`devices/${deviceId}/status`).once('value');
  const status = snap.val() || {
    online: false,
    lastSeen: 0,
    firmwareVersion: 'unknown'
  };

  const now = Math.floor(Date.now() / 1000);
  const isOnline = status.lastSeen > 0 && (now - status.lastSeen <= 15);

  return {
    success: true,
    deviceId,
    online: isOnline,
    lastSeen: status.lastSeen,
    secondsAgo: status.lastSeen ? now - status.lastSeen : null,
    firmwareVersion: status.firmwareVersion
  };
}

/**
 * Retrieves historical telemetry records for a given date.
 */
export async function getHistoryRecords(deviceId = 'kwh-meter-001', dateStr = null, limit = 500) {
  const { db } = getDatabase();
  const date = dateStr || getJakartaDateKey(Math.floor(Date.now() / 1000));
  const safeLimit = Math.min(parseInt(limit, 10) || 500, 2000);

  const snap = await db.ref(`history/${deviceId}/${date}`).once('value');
  const recordsMap = snap.val() || {};

  const records = Object.entries(recordsMap).map(([key, r]) => ({
    id: key,
    timestamp: r.t,
    sequence: r.seq,
    voltage: r.v,
    current: r.i,
    activePower: r.p,
    powerFactor: r.pf,
    energy: r.e,
    frequency: r.f,
    timeString: new Date(r.t * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  })).sort((a, b) => b.sequence - a.sequence).slice(0, safeLimit);

  return {
    success: true,
    deviceId,
    date,
    count: records.length,
    records
  };
}

/**
 * Formats telemetry records into a professional, human-readable RFC 4180 / Excel CSV with UTF-8 BOM.
 */
export function formatRecordsAsCsv(records = [], deviceId = 'kwh-meter-001', date = '') {
  const metadata = [
    `# LAPORAN TELEMETRI KWH METER IOT (ESP32 + PZEM-004T)`,
    `# ID Perangkat: ${deviceId}`,
    `# Tanggal Rekaman: ${date || 'Semua Data Tersedia'}`,
    `# Total Catatan: ${records.length}`,
    `# Waktu Ekspor: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    `# Format Delimiter: Titik-Koma (Semicolon) untuk Kompatibilitas Microsoft Excel & Spreadsheet`,
    `#`
  ];

  const headers = [
    'No',
    'Waktu (WIB)',
    'Tegangan (V)',
    'Arus (A)',
    'Daya Aktif (W)',
    'Faktor Daya (cos φ)',
    'Frekuensi (Hz)',
    'Energi Kumulatif (kWh)',
    'Sequence'
  ];

  const rows = records.map((r, idx) => [
    idx + 1,
    `"${r.timeString || ''}"`,
    Number(r.voltage || 0).toFixed(1),
    Number(r.current || 0).toFixed(2),
    Number(r.activePower || 0).toFixed(1),
    Number(r.powerFactor || 0).toFixed(2),
    Number(r.frequency || 50).toFixed(1),
    Number(r.energy || 0).toFixed(3),
    r.sequence || (idx + 1)
  ].join(';'));

  return '\uFEFF' + [...metadata, headers.join(';'), ...rows].join('\r\n');
}

/**
 * Resets history, batches, and energy summaries in the database for a device.
 */
export async function resetDeviceDatabase(deviceId = 'kwh-meter-001') {
  const { db } = getDatabase();
  await Promise.all([
    db.ref(`devices/${deviceId}/history`).remove(),
    db.ref(`devices/${deviceId}/batches`).remove(),
    db.ref(`summaries/${deviceId}`).remove(),
    db.ref(`devices/${deviceId}/latest`).set(null)
  ]);
  return { success: true, message: `Database riwayat dan ringkasan untuk ${deviceId} berhasil direset.` };
}

/**
 * Retrieves energy summaries (daily, monthly, cost estimations) for a device.
 */
export async function getEnergySummary(deviceId = 'kwh-meter-001') {
  const { db } = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const dateKey = getJakartaDateKey(now);
  const monthKey = getJakartaMonthKey(now);

  const [dailySnap, monthlySnap, latestSnap] = await Promise.all([
    db.ref(`summaries/${deviceId}/daily/${dateKey}`).once('value'),
    db.ref(`summaries/${deviceId}/monthly/${monthKey}`).once('value'),
    db.ref(`devices/${deviceId}/latest`).once('value')
  ]);

  const daily = dailySnap.val() || {
    date: dateKey,
    deltaEnergy: 0,
    costEstimated: 0,
    peakPower: 0,
    avgPower: 0
  };

  const monthly = monthlySnap.val() || {
    month: monthKey,
    totalKwh: 0,
    totalCost: 0,
    peakPower: 0
  };

  const latest = latestSnap.val() || {};
  const tariff = parseFloat(process.env.DEFAULT_TARIFF_PER_KWH || '1444.70');

  return {
    success: true,
    deviceId,
    tariffPerKwh: tariff,
    today: {
      date: dateKey,
      kwh: daily.deltaEnergy,
      cost: daily.costEstimated,
      peakPower: daily.peakPower,
      avgPower: daily.avgPower
    },
    thisMonth: {
      month: monthKey,
      totalKwh: monthly.totalKwh,
      totalCost: monthly.totalCost,
      peakPower: monthly.peakPower
    },
    cumulativeEnergy: latest.energy || 0,
    lastUpdate: latest.timestamp || null
  };
}
