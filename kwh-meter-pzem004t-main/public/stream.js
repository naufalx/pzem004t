/**
 * Realtime Telemetry Stream Manager
 * Encapsulates Firebase Web SDK listener with transparent REST stream fallback.
 */

export async function initRealtimeStream({ onTelemetry, onStatus, onSummary }) {
  // 1. Fetch dynamic configuration
  let config = window.FIREBASE_CONFIG;
  if (!config) {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        config = await res.json();
        window.FIREBASE_CONFIG = config;
      }
    } catch (e) {
      console.warn('Could not load /api/config, checking fallback:', e.message);
    }
  }

  // 2. Try Firebase Realtime Database Web SDK first
  if (config && config.databaseURL) {
    try {
      console.log('✓ Initializing Firebase Realtime Database Web SDK...');
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getDatabase, ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

      const app = initializeApp(config);
      const db = getDatabase(app);
      const deviceId = config.deviceId || 'kwh-meter-001';

      console.log(`✓ Subscribed to Firebase Realtime Database: devices/${deviceId}`);

      // Dynamic Heartbeat Watchdog
      let lastSeenTimestamp = 0;

      function evaluateWatchdog() {
        const nowSec = Math.floor(Date.now() / 1000);
        // ESP32 uploads batches every 5s. If no batch within 15s or lastSeen is 0, device is offline!
        const isOnline = lastSeenTimestamp > 0 && (nowSec - lastSeenTimestamp <= 15);
        if (onStatus) {
          onStatus(isOnline, isOnline ? 'Online' : 'Device Offline');
        }
      }

      // Initial state is offline until verified
      evaluateWatchdog();

      // Telemetry listener
      onValue(ref(db, `devices/${deviceId}/latest`), snap => {
        const val = snap.val();
        if (val) {
          const recTime = val.serverReceivedAt || val.timestamp || 0;
          if (recTime > lastSeenTimestamp) {
            lastSeenTimestamp = recTime;
            evaluateWatchdog();
          }
          if (onTelemetry) onTelemetry(val);
        }
      });

      // Status listener
      onValue(ref(db, `devices/${deviceId}/status`), snap => {
        const val = snap.val();
        if (val && typeof val.lastSeen === 'number') {
          if (val.lastSeen > lastSeenTimestamp) {
            lastSeenTimestamp = val.lastSeen;
          }
        }
        evaluateWatchdog();
      });

      // Periodic Watchdog Tick (runs every 2 seconds to transition to Offline if heartbeat ceases)
      setInterval(evaluateWatchdog, 2000);

      // Daily summary listener
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      onValue(ref(db, `summaries/${deviceId}/daily/${todayKey}`), snap => {
        const val = snap.val();
        if (val && onSummary) onSummary(val);
      });

      return;
    } catch (err) {
      console.warn('⚠ Firebase Web SDK connection failed, activating REST stream fallback:', err);
    }
  }

  // 3. Fallback: REST polling stream (2s interval)
  console.log('✓ Running on local/cloud REST stream fallback mode...');
  setInterval(async () => {
    try {
      const res = await fetch('/api/device/status');
      if (res.ok) {
        const status = await res.json();
        if (status.online) {
          if (onStatus) onStatus(true, 'Online');

          const sumRes = await fetch('/api/summary');
          if (sumRes.ok && onSummary) {
            const sumData = await sumRes.json();
            if (sumData.today) onSummary({ kwh: sumData.today.kwh });
          }

          const histRes = await fetch('/api/history?limit=1');
          if (histRes.ok) {
            const hist = await histRes.json();
            if (hist.records && hist.records[0] && onTelemetry) {
              onTelemetry(hist.records[0]);
            }
          }
        } else {
          if (onStatus) onStatus(false, 'Device Offline');
        }
      }
    } catch (err) {
      if (onStatus) onStatus(false, 'Server Unreachable');
    }
  }, 2000);
}
