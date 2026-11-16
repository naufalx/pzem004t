/**
 * KWH Meter - Unified Realtime Dashboard Application
 * Supports Firebase Web SDK Listener (onValue) with graceful REST API fallback.
 */

import { TimeSeriesChart } from './chart.js';
import { initRealtimeStream } from './stream.js?v=2,3,1';

// Nama halaman tanpa ekstensi (Firebase Hosting memakai cleanUrls: /riwayat, bukan /riwayat.html)
function currentPageName() {
  const last = location.pathname.split('/').pop() || 'index';
  return last.replace(/\.html$/, '') || 'index';
}

// Tanggal hari ini menurut zona waktu Jakarta (YYYY-MM-DD), sama dengan kunci di RTDB
function jakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

// Baca riwayat langsung dari Firebase RTDB: history/<deviceId>/<YYYY-MM-DD>
async function loadHistoryFromFirebase(dateStr, limit = 0) {
  const config = window.FIREBASE_CONFIG;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
  const { getDatabase, ref, get, query, orderByChild, limitToLast } =
    await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const db = getDatabase(app);
  const deviceId = config.deviceId || 'kwh-meter-001';
  const base = ref(db, `history/${deviceId}/${dateStr || jakartaDateKey()}`);
  const snap = await get(limit ? query(base, orderByChild('t'), limitToLast(limit)) : base);
  const val = snap.val() || {};
  return Object.values(val)
    .map(r => ({
      timestamp: Number(r.t) * 1000,
      timeString: new Date(Number(r.t) * 1000).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }),
      voltage: r.v, current: r.i, activePower: r.p,
      powerFactor: r.pf, energy: r.e, frequency: r.f
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

let powerChart = null;
let currentChart = null;
let isConnected = false;
let lastHeartbeat = 0;

// Settings & Local Storage State
const SETTINGS_KEY = 'kwh_meter_settings';
const DEFAULT_SETTINGS = {
  deviceName: 'KWH METER ESP32',
  tariffPerKwh: 1444.70,
  powerLimit: 1300,
  energyOffset: 0
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      deviceName: parsed.deviceName || DEFAULT_SETTINGS.deviceName,
      tariffPerKwh: Number(parsed.tariffPerKwh) > 0 ? Number(parsed.tariffPerKwh) : DEFAULT_SETTINGS.tariffPerKwh,
      powerLimit: Number(parsed.powerLimit) > 0 ? Number(parsed.powerLimit) : DEFAULT_SETTINGS.powerLimit,
      energyOffset: Number(parsed.energyOffset) || 0
    };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  applySettings(updated);
  return updated;
}

export function applySettings(settings) {
  const s = settings || getSettings();

  // Update brand/title if element exists
  const brandSub = document.querySelector('.brand span');
  if (brandSub && s.deviceName) {
    brandSub.textContent = s.deviceName;
  }
  const espHostEl = $('espHost');
  if (espHostEl && s.deviceName) {
    espHostEl.textContent = s.deviceName;
  }

  // Populate inputs on pengaturan.html
  const devNameInput = $('deviceName');
  if (devNameInput && document.activeElement !== devNameInput) {
    devNameInput.value = s.deviceName;
  }
  const tariffInput = $('tariffPerKwh');
  if (tariffInput && document.activeElement !== tariffInput) {
    tariffInput.value = s.tariffPerKwh;
  }
  const limitInput = $('powerLimit');
  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = s.powerLimit;
  }

  // Update tariff info on energy.html
  const costTariffInfo = $('costTariffInfo');
  if (costTariffInfo) {
    costTariffInfo.textContent = `Tarif: Rp ${s.tariffPerKwh.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / kWh`;
  }
}

function $(id) {
  return document.getElementById(id);
}

function formatNumber(val, digits = 2) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : '--';
}

function setText(id, val) {
  const el = $(id);
  if (el && val !== undefined && val !== null) {
    el.textContent = val;
  }
}

function setMeter(selector, percent) {
  const el = document.querySelector(selector);
  if (el) {
    el.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }
}

function setStatus(online, detail = '') {
  isConnected = online;
  const text = $('connectionStatus');
  const box = $('espStatus');
  const dot = box ? box.querySelector('i') : null;

  const statusLabel = online ? 'Online' : (detail || 'Offline');
  if (text) {
    text.textContent = statusLabel;
    text.style.color = '';
  }
  if (box) {
    box.classList.toggle('offline', !online);
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('title', online ? 'ESP32: Online & Telemetri Real-time Aktif' : `ESP32: ${statusLabel} (Watchdog 15s)`);
  }
  if (dot) dot.classList.toggle('offline', !online);

  document.querySelectorAll('[data-connection]').forEach(el => {
    el.textContent = online ? 'Terhubung (Cloud)' : 'Terputus';
    el.classList.toggle('offline', !online);
  });
}

// Realtime Data Binding
export function applyTelemetry(data) {
  if (!data) return;
  lastHeartbeat = Date.now();

  const settings = getSettings();
  const voltage = data.voltage ?? data.v;
  const current = data.current ?? data.i;
  const pf = data.powerFactor ?? data.pf;
  const power = data.activePower ?? data.p;
  const rawEnergy = Number(data.energy ?? data.e) || 0;
  const displayEnergy = Math.max(0, rawEnergy - settings.energyOffset);

  setText('voltage', formatNumber(voltage, 1));
  setText('current', formatNumber(current, 2));
  setText('powerFactor', formatNumber(pf, 2));
  setText('activePower', formatNumber(power, 1));
  setText('energyTotal', formatNumber(displayEnergy, 3));
  setText('energyTotalSide', formatNumber(displayEnergy, 2) + ' kWh');

  // Real-time page bindings
  setText('tVoltage', formatNumber(voltage, 1));
  setText('tCurrent', formatNumber(current, 2));
  setText('tPf', formatNumber(pf, 2));
  setText('tPower', formatNumber(power, 1));
  setText('tEnergy', formatNumber(displayEnergy, 3));

  // Power Quality Diagnostics Calculations
  const vNum = Number(voltage) || 0;
  const iNum = Number(current) || 0;
  const pNum = Number(power) || 0;
  const freq = Number(data.frequency || data.f || 50.0);
  const apparentVA = vNum * iNum;
  const reactiveVAR = Math.sqrt(Math.max(0, (apparentVA * apparentVA) - (pNum * pNum)));

  setText('diagFrequency', formatNumber(freq, 1));
  setText('diagApparentPower', formatNumber(apparentVA, 1));
  setText('diagReactivePower', formatNumber(reactiveVAR, 1));
  const freqPct = Math.max(0, Math.min(100, ((freq - 45) / 10) * 100));
  setMeter('#diagFrequencyMeter', freqPct);
  setMeter('#diagApparentMeter', Math.min(100, (apparentVA / (settings.powerLimit || 1300)) * 100));
  setMeter('#diagReactiveMeter', Math.min(100, (reactiveVAR / (settings.powerLimit || 1300)) * 100));
  const pfNum = Number(pf) || 0;
  setMeter('#diagPfMeter', Math.max(0, Math.min(100, pfNum * 100)));

  const vStatusEl = $('diagVoltageStatus');
  if (vStatusEl) {
    if (vNum >= 198 && vNum <= 242) {
      vStatusEl.textContent = 'Normal (220V ±10%)';
      vStatusEl.style.color = 'var(--green-text)';
    } else if (vNum < 198) {
      vStatusEl.textContent = 'Under-Voltage (<198V)';
      vStatusEl.style.color = 'var(--danger-light)';
    } else {
      vStatusEl.textContent = 'Over-Voltage (>242V)';
      vStatusEl.style.color = 'var(--danger-light)';
    }
  }

  // Energy page bindings
  setText('energy', formatNumber(displayEnergy, 3));
  setText('energyVoltage', formatNumber(voltage, 1) + ' V');
  setText('energyCurrent', formatNumber(current, 2) + ' A');
  setText('energyPower', formatNumber(power, 1) + ' W');

  const mcbLimit = Number(settings.powerLimit) || 1300;
  const mcbPct = Math.min(100, Math.round((pNum / mcbLimit) * 100));
  setText('mcbLoadPct', `${mcbPct}%`);
  setMeter('#mcbLoadMeter', mcbPct);
  setText('mcbCapacityText', `Batas Daya MCB: ${mcbLimit.toLocaleString('id-ID')} Watt`);

  // Dynamic Cost Calculation
  const totalCost = displayEnergy * settings.tariffPerKwh;
  const costStr = 'Rp ' + Math.round(totalCost).toLocaleString('id-ID');
  setText('energyCostEst', costStr);
  setText('costTotal', costStr);

  // Overload Alarm Watchdog
  const powerNum = Number(power);
  const powerCard = document.querySelector('.metric-card.power');
  const alertBanner = $('overloadAlertBanner');
  if (Number.isFinite(powerNum) && powerNum > settings.powerLimit) {
    if (powerCard) powerCard.classList.add('overload-alarm');
    if (alertBanner) {
      alertBanner.style.display = 'flex';
      alertBanner.textContent = `⚠️ PERINGATAN: Beban daya (${formatNumber(powerNum, 1)} W) melebihi batas MCB (${settings.powerLimit} W)!`;
    }
  } else {
    if (powerCard) powerCard.classList.remove('overload-alarm');
    if (alertBanner) {
      alertBanner.style.display = 'none';
    }
  }

  // Progress meters
  if (Number.isFinite(Number(voltage))) setMeter('.voltage .meter span', (Number(voltage) / 250) * 100);
  if (Number.isFinite(Number(current))) setMeter('.current .meter span', (Number(current) / 10) * 100);
  if (Number.isFinite(Number(pf))) setMeter('.pf .meter span', Number(pf) * 100);
  if (Number.isFinite(Number(power))) setMeter('.power .meter span', (Number(power) / (settings.powerLimit || 1500)) * 100);

  // Update Dynamic Chart
  if (powerChart && Number.isFinite(Number(power))) {
    powerChart.addDataPoint(power);
  }

  // Prepend live row to real-time table
  const body = $('historyBody');
  if (body && body.dataset.liveRows === 'true') {
    const placeholder = body.querySelector('tr td[colspan]');
    if (placeholder) {
      placeholder.closest('tr').remove();
    }

    const tr = document.createElement('tr');
    const timeStr = new Date().toLocaleTimeString('id-ID');
    [timeStr, formatNumber(voltage, 1), formatNumber(current, 2), formatNumber(pf, 2), formatNumber(power, 1), formatNumber(displayEnergy, 3)].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    body.prepend(tr);
    while (body.children.length > 25) {
      body.removeChild(body.lastElementChild);
    }
  }
}

// Preload recent telemetries on initial page load for index.html
async function preloadRecentTelemetriesForIndex() {
  const body = $('historyBody');
  if (!body || body.dataset.liveRows !== 'true') return;

  try {
    const data = { records: await loadHistoryFromFirebase(jakartaDateKey(), 10) };
    if (!data.records || data.records.length === 0) return;

    const placeholder = body.querySelector('tr td[colspan]');
    if (placeholder) {
      placeholder.closest('tr').remove();
    }

    const recent = data.records.slice(0, 10);
    body.replaceChildren();
    recent.forEach(r => {
      const tr = document.createElement('tr');
      [
        r.timeString || new Date(r.timestamp).toLocaleTimeString('id-ID'),
        formatNumber(r.voltage, 1),
        formatNumber(r.current, 2),
        formatNumber(r.powerFactor, 2),
        formatNumber(r.activePower, 1),
        formatNumber(r.energy, 3)
      ].forEach(v => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  } catch (err) {
    console.warn('Preload recent telemetries notice:', err);
  }
}

// Fetch Energy Summaries (Today, Month, Year, Cost)
async function fetchSummary() {
  try {
    const res = await fetch('/api/summary');
    if (!res.ok) return;
    const data = await res.json();
    const settings = getSettings();

    if (data.today) {
      setText('energyToday', formatNumber(data.today.kwh, 2) + ' kWh');
      const costToday = (data.today.kwh || 0) * settings.tariffPerKwh;
      setText('costToday', 'Rp ' + Math.round(costToday).toLocaleString('id-ID'));
    }
    if (data.thisMonth) {
      setText('energyMonth', formatNumber(data.thisMonth.totalKwh, 2) + ' kWh');
      const costMonth = (data.thisMonth.totalKwh || 0) * settings.tariffPerKwh;
      setText('costMonth', 'Rp ' + Math.round(costMonth).toLocaleString('id-ID'));
    }
    setText('energyYear', formatNumber((data.thisMonth?.totalKwh || 0), 2) + ' kWh');
  } catch (err) {
    console.warn('Failed to fetch summary:', err);
  }
}

// History Pagination State
let allHistoryRecords = [];
let currentHistoryPage = 1;
let historyPageSize = window.innerWidth < 768 ? 10 : 25;

function renderHistoryPage() {
  const body = $('historyBody');
  if (!body) return;

  const total = allHistoryRecords.length;
  if (total === 0) {
    body.innerHTML = '<tr><td colspan="6">Belum ada rekaman riwayat untuk tanggal ini.</td></tr>';
    setText('paginationRange', 'Menampilkan 0–0 dari 0 rekaman');
    setText('paginationPage', 'Halaman 1 dari 1');
    const prevBtn = $('btnPrevPage');
    const nextBtn = $('btnNextPage');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / historyPageSize));
  if (currentHistoryPage > totalPages) currentHistoryPage = totalPages;
  if (currentHistoryPage < 1) currentHistoryPage = 1;

  const startIdx = (currentHistoryPage - 1) * historyPageSize;
  const endIdx = Math.min(startIdx + historyPageSize, total);
  const pageRecords = allHistoryRecords.slice(startIdx, endIdx);

  body.replaceChildren();
  pageRecords.forEach(r => {
    const tr = document.createElement('tr');
    [
      r.timeString || new Date(r.timestamp).toLocaleTimeString('id-ID'),
      formatNumber(r.voltage, 1),
      formatNumber(r.current, 2),
      formatNumber(r.powerFactor, 2),
      formatNumber(r.activePower, 1),
      formatNumber(r.energy, 3)
    ].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  setText('paginationRange', `Menampilkan ${startIdx + 1}–${endIdx} dari ${total} rekaman`);
  setText('paginationPage', `Halaman ${currentHistoryPage} dari ${totalPages}`);

  const prevBtn = $('btnPrevPage');
  const nextBtn = $('btnNextPage');
  if (prevBtn) prevBtn.disabled = currentHistoryPage <= 1;
  if (nextBtn) nextBtn.disabled = currentHistoryPage >= totalPages;
}

function setupPagination() {
  const prevBtn = $('btnPrevPage');
  const nextBtn = $('btnNextPage');
  const sizeSelect = $('pageSizeSelect');

  if (sizeSelect) {
    sizeSelect.value = String(historyPageSize);
    sizeSelect.addEventListener('change', () => {
      historyPageSize = parseInt(sizeSelect.value, 10) || 25;
      currentHistoryPage = 1;
      renderHistoryPage();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentHistoryPage > 1) {
        currentHistoryPage--;
        renderHistoryPage();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(allHistoryRecords.length / historyPageSize));
      if (currentHistoryPage < totalPages) {
        currentHistoryPage++;
        renderHistoryPage();
      }
    });
  }
}

// Fetch Filtered History from Server
async function fetchHistory(dateStr = '') {
  const body = $('historyBody');
  if (!body || currentPageName() !== 'riwayat') return;

  try {
    body.innerHTML = '<tr><td colspan="6">Memuat riwayat dari cloud...</td></tr>';
    const data = { records: await loadHistoryFromFirebase(dateStr) };

    if (!data.records || data.records.length === 0) {
      allHistoryRecords = [];
      currentHistoryPage = 1;
      renderHistoryPage();
      setText('historyCount', '0 catatan');
      setText('dailySummaryCount', '0 baris');
      setText('dailySummaryKwh', '0.000 kWh');
      setText('dailySummaryCost', 'Rp 0');
      return;
    }

    allHistoryRecords = data.records;
    currentHistoryPage = 1;
    renderHistoryPage();

    setText('historyCount', `${data.records.length} catatan`);
    setText('dailySummaryCount', `${data.records.length} baris`);

    const energies = data.records.map(r => Number(r.energy) || 0).filter(n => Number.isFinite(n) && n > 0);
    const minE = energies.length > 0 ? Math.min(...energies) : 0;
    const maxE = energies.length > 0 ? Math.max(...energies) : 0;
    const deltaKwh = Math.max(0, maxE - minE);
    setText('dailySummaryKwh', formatNumber(deltaKwh, 3) + ' kWh');
    const settings = getSettings();
    const estCost = deltaKwh * settings.tariffPerKwh;
    setText('dailySummaryCost', 'Rp ' + Math.round(estCost).toLocaleString('id-ID'));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6">Gagal memuat riwayat: ${err.message}</td></tr>`;
  }
}

async function downloadCSV() {
  const dateInput = $('historyDateFilter')?.value || jakartaDateKey();
  try {
    const records = (allHistoryRecords.length && $('historyDateFilter')) ? allHistoryRecords
      : await loadHistoryFromFirebase(dateInput);
    const header = 'waktu,tegangan_V,arus_A,power_factor,daya_W,energi_kWh,frekuensi_Hz';
    const rows = records.map(r => [r.timeString, r.voltage, r.current, r.powerFactor, r.activePower, r.energy, r.frequency].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `riwayat-${dateInput}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    alert('Gagal mengekspor CSV: ' + err.message);
  }
}

// Realtime Stream Connection via Stream Manager
function startTelemetryStream() {
  initRealtimeStream({
    onTelemetry: (val) => applyTelemetry(val),
    onStatus: (online, detail) => setStatus(online, detail),
    onSummary: (val) => {
      if (val && val.kwh !== undefined) {
        setText('energyToday', formatNumber(val.kwh, 2) + ' kWh');
        const settings = getSettings();
        const costToday = (val.kwh || 0) * settings.tariffPerKwh;
        setText('costToday', 'Rp ' + Math.round(costToday).toLocaleString('id-ID'));
      }
    }
  });
}

// UI Navigation & Initialization
function setupNavigation() {
  const sidebar = document.querySelector('.sidebar');
  const menu = document.querySelector('.menu');
  const overlay = $('sidebarOverlay');

  if (menu && sidebar && overlay) {
    menu.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      }
    });
  }

  let current = location.pathname.split('/').pop() || 'index.html';
  if (!current.endsWith('.html') && current !== '') {
    current += '.html';
  }
  if (current === '' || current === '/') current = 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = (item.getAttribute('href') || '').split('/').pop();
    item.classList.toggle('active', href === current);
  });
}

function updateClock() {
  const now = new Date();
  setText('sideDate', now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
  setText('sideTime', now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
}

async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }
    await res.text();
    return {
      ok: false,
      status: res.status,
      data: { error: `Server mengembalikan respon non-JSON (${res.status}).` }
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err.message || 'Koneksi jaringan terputus' }
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  updateClock();
  setInterval(updateClock, 1000);
  applySettings();

  // Initialize Canvas Chart if element exists
  if ($('activePowerChart')) {
    powerChart = new TimeSeriesChart('activePowerChart', {
      lineColor: '#0070f3',
      unit: 'W',
      maxPoints: 40
    });
  }

  fetchSummary();
  setInterval(fetchSummary, 10000);

  startTelemetryStream();

  // Settings page action bindings
  const saveBtn = $('btnSaveSettings');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name = $('deviceName')?.value.trim() || DEFAULT_SETTINGS.deviceName;
      const tariff = parseFloat($('tariffPerKwh')?.value) || DEFAULT_SETTINGS.tariffPerKwh;
      const limit = parseFloat($('powerLimit')?.value) || DEFAULT_SETTINGS.powerLimit;

      saveSettings({ deviceName: name, tariffPerKwh: tariff, powerLimit: limit });

      const info = $('saveInfo');
      if (info) {
        info.textContent = '✓ Pengaturan berhasil disimpan!';
        info.style.color = 'var(--green)';
        setTimeout(() => { info.textContent = ''; }, 3500);
      }
    });
  }

  const resetBtn = $('btnResetEnergy');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Konfirmasi: Apakah Anda yakin ingin mereset baseline akumulasi kWh pada antarmuka dashboard?')) {
        const curEnergy = parseFloat($('energyTotal')?.textContent) || 0;
        const currentSettings = getSettings();
        saveSettings({ energyOffset: (currentSettings.energyOffset || 0) + curEnergy });
        const resetInfo = $('resetInfo');
        if (resetInfo) {
          resetInfo.textContent = '✓ Baseline energi berhasil direset ke 0.000 kWh!';
          resetInfo.style.color = 'var(--green)';
          setTimeout(() => { resetInfo.textContent = ''; }, 4000);
        }
      }
    });
  }

  // Cloud Database Reset action
  const resetDbBtn = $('btnResetDatabase');
  if (resetDbBtn) {
    resetDbBtn.addEventListener('click', async () => {
      const confirm1 = confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SELURUH riwayat telemetri di Firebase Realtime Database?');
      if (!confirm1) return;
      const confirm2 = confirm('Konfirmasi kedua: Tindakan ini permanen dan tidak dapat dibatalkan. Lanjutkan reset database?');
      if (!confirm2) return;

      const dbInfo = $('dbResetInfo');
      if (dbInfo) {
        dbInfo.textContent = 'Mereset database cloud...';
        dbInfo.style.color = 'var(--yellow)';
      }

      try {
        let result = await safeFetchJson('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: 'kwh-meter-001' })
        });

        if (!result.ok) {
          result = await safeFetchJson('/api/device/reset-database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: 'kwh-meter-001' })
          });
        }

        if (!result.ok) {
          result = await safeFetchJson('/api/history', { method: 'DELETE' });
        }

        if (result.ok && result.data?.success) {
          if (dbInfo) {
            dbInfo.textContent = '✓ Database riwayat cloud berhasil direset bersih!';
            dbInfo.style.color = 'var(--green)';
            setTimeout(() => { dbInfo.textContent = ''; }, 4500);
          }
        } else {
          throw new Error(result.data?.error || result.data?.message || 'Gagal mereset database');
        }
      } catch (err) {
        if (dbInfo) {
          dbInfo.textContent = `❌ Gagal: ${err.message}`;
          dbInfo.style.color = 'var(--danger)';
        }
      }
    });
  }

  // Index page live table preload
  const currentPageFile = currentPageName();
  if (currentPageFile === 'index') {
    preloadRecentTelemetriesForIndex();
  }

  // History page setup
  if (currentPageFile === 'riwayat') {
    setupPagination();
    const datePicker = $('historyDateFilter');
    const todayStr = jakartaDateKey();
    if (datePicker && !datePicker.value) {
      datePicker.value = todayStr;
    }

    fetchHistory(datePicker?.value || '');

    if (datePicker) {
      datePicker.addEventListener('change', () => {
        fetchHistory(datePicker.value);
      });
    }

    const expBtn = $('exportCsv');
    if (expBtn) expBtn.addEventListener('click', downloadCSV);
    const refBtn = $('refreshHistory');
    if (refBtn) refBtn.addEventListener('click', () => {
      fetchHistory(datePicker?.value || '');
    });
  }

  // Dashboard export button
  const expDash = $('exportDashboard');
  if (expDash) expDash.addEventListener('click', downloadCSV);
});