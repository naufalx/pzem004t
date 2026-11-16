/**
 * Firebase Realtime Database stream.
 * Reads the same database path written directly by the ESP32 firmware.
 */
export async function initRealtimeStream({ onTelemetry, onStatus, onSummary }) {
  const config = window.FIREBASE_CONFIG;
  if (!config?.databaseURL) {
    console.error('[Firebase] Missing public/firebase-config.js configuration.');
    onStatus?.(false, 'Firebase belum dikonfigurasi');
    return;
  }

  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getDatabase, ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    const db = getDatabase(app);
    const deviceId = config.deviceId || 'kwh-meter-001';
    let lastSeen = 0;

    const checkStatus = () => {
      const online = lastSeen > 0 && (Date.now() / 1000 - lastSeen <= 20);
      onStatus?.(online, online ? 'Online' : 'Device Offline');
    };

    onValue(ref(db, `devices/${deviceId}/latest`), snap => {
      const data = snap.val();
      if (!data) { checkStatus(); return; }
      const stamp = Number(data.timestamp || data.t || 0);
      if (stamp > lastSeen) lastSeen = stamp;
      onTelemetry?.(data);
      checkStatus();
    }, err => {
      console.error('[Firebase] latest listener:', err);
      onStatus?.(false, 'Gagal membaca Firebase');
    });

    onValue(ref(db, `devices/${deviceId}/status`), snap => {
      const status = snap.val() || {};
      const stamp = Number(status.lastSeen || 0);
      if (stamp > lastSeen) lastSeen = stamp;
      checkStatus();
    }, err => {
      console.error('[Firebase] status listener:', err);
      onStatus?.(false, 'Gagal membaca status Firebase');
    });

    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    onValue(ref(db, `summaries/${deviceId}/daily/${dayKey}`), snap => {
      const val = snap.val();
      if (val) onSummary?.(val);
    });

    // Re-evaluate stale heartbeat so the UI transitions to Offline without refreshing.
    setInterval(checkStatus, 2000);
    console.info(`[Firebase] Realtime connected: devices/${deviceId}`);
  } catch (err) {
    console.error('[Firebase] Initialization failed:', err);
    onStatus?.(false, 'Firebase tidak dapat diakses');
  }
}
