/**
 * Mock ESP32 + PZEM-004T Device Simulator CLI
 * 100% Contract Match with Vercel API and Real ESP32 Firmware.
 */

import readline from 'readline';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { ElectricalPhysicsEngine } from './physics.js';
import { SIMULATION_PROFILES } from './modes.js';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID || 'kwh-meter-001';
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || 'c8f93e2b1049a8d7e6f5c4b3a2918273645e4d3c2b1a0987f6e5d4c3b2a10987';
const FIRMWARE_VERSION = '2.0.0-simulator';

export class DeviceSimulator {
  constructor(options = {}) {
    this.apiBaseUrl = (options.apiBaseUrl || API_BASE_URL).replace(/\/api\/telemetry\/?$/, '').replace(/\/+$/, '');
    this.deviceId = options.deviceId || DEVICE_ID;
    this.deviceToken = options.deviceToken || DEVICE_TOKEN;
    this.sampleIntervalMs = options.sampleIntervalMs || 1000;
    this.uploadIntervalMs = options.uploadIntervalMs || 5000;
    this.currentMode = options.mode || 'normal';

    this.engine = new ElectricalPhysicsEngine(10.000);
    this.batchBuffer = [];
    this.offlineQueue = [];
    this.isRunning = false;
    this.sampleTimer = null;
    this.uploadTimer = null;
    this.lastUploadStatus = 'Init';
    this.totalBatchesSent = 0;
  }

  setMode(mode) {
    if (!SIMULATION_PROFILES[mode]) {
      console.log(`❌ Unknown mode: "${mode}". Valid modes: ${Object.keys(SIMULATION_PROFILES).join(', ')}`);
      return false;
    }
    const oldMode = this.currentMode;
    this.currentMode = mode;
    console.log(`⚡ Mode changed: [${oldMode}] -> [${mode}] (${SIMULATION_PROFILES[mode].name})`);

    // If returning from offline mode, flush offline queue
    if (oldMode === 'offline' && mode !== 'offline') {
      console.log(`🔄 Reconnected to network. Draining ${this.offlineQueue.length} queued records...`);
      this.flushOfflineQueue();
    }
    return true;
  }

  sample() {
    const profile = SIMULATION_PROFILES[this.currentMode] || SIMULATION_PROFILES.normal;

    if (this.currentMode === 'sensor-error') {
      // Injects invalid data (NaN / null) to verify backend boundary checks
      const badRecord = {
        timestamp: Math.floor(Date.now() / 1000),
        sequence: this.engine.sequence + 1,
        voltage: NaN,
        current: -5.0,
        powerFactor: 1.5,
        activePower: 99999.0,
        energy: 12.0,
        frequency: 50.0
      };
      this.batchBuffer.push(badRecord);
      return badRecord;
    }

    const record = this.engine.step({
      targetCurrent: profile.targetCurrent,
      powerFactor: profile.powerFactor,
      dtSeconds: this.sampleIntervalMs / 1000.0
    });

    if (profile.isOffline) {
      this.offlineQueue.push(record);
    } else {
      this.batchBuffer.push(record);
    }

    return record;
  }

  async uploadBatch(recordsToSend) {
    if (!recordsToSend || recordsToSend.length === 0) return;

    const batchId = crypto.randomUUID();
    const payload = {
      deviceId: this.deviceId,
      batchId,
      firmwareVersion: FIRMWARE_VERSION,
      sentAt: Math.floor(Date.now() / 1000),
      records: recordsToSend
    };

    const profile = SIMULATION_PROFILES[this.currentMode];
    if (profile?.failHttp) {
      this.lastUploadStatus = 'Failed (Simulated Network Failure)';
      console.log(`⚠ [Simulator] Simulated Network Failure on Batch ${batchId.substring(0, 8)}`);
      return;
    }

    try {
      const url = `${this.apiBaseUrl}/api/telemetry`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deviceToken}`,
          'x-device-id': this.deviceId
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        this.totalBatchesSent += 1;
        this.lastUploadStatus = `OK (HTTP ${res.status})`;
        const latest = recordsToSend[recordsToSend.length - 1];
        console.log(`[Simulator -> API] ✓ Batch ${batchId.substring(0, 8)} (${recordsToSend.length} recs) sent | V: ${latest.voltage}V, I: ${latest.current}A, P: ${latest.activePower}W, E: ${latest.energy}kWh`);
      } else {
        this.lastUploadStatus = `Rejected (HTTP ${res.status}: ${data.error || data.message})`;
        console.warn(`[Simulator -> API] ❌ HTTP ${res.status}:`, data.message);
      }
    } catch (err) {
      this.lastUploadStatus = `Network Error (${err.message})`;
      console.error(`[Simulator -> API] ❌ Network Error:`, err.message);
      // Re-queue records into offlineQueue on network failure
      this.offlineQueue.push(...recordsToSend);
    }
  }

  async flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    const records = [...this.offlineQueue];
    this.offlineQueue = [];

    // Upload in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await this.uploadBatch(chunk);
    }
  }

  /**
   * Fast-forwards simulation for N days to verify monthly summaries and billing!
   */
  async accelerate(days = 30) {
    console.log(`\n⏩ ACCELERATING SIMULATION: Generating ${days} days of realistic telemetry...`);
    const now = Math.floor(Date.now() / 1000);
    const startEpoch = now - (days * 24 * 3600);
    const stepSeconds = 300; // 5-minute intervals across 30 days
    const totalSteps = Math.floor((days * 24 * 3600) / stepSeconds);

    console.log(`   Generating ${totalSteps} data points across ${days} days...`);

    let curEpoch = startEpoch;
    let recordsChunk = [];
    let sentCount = 0;

    for (let i = 0; i < totalSteps; i++) {
      curEpoch += stepSeconds;
      const hour = new Date(curEpoch * 1000).getHours();

      // Realistic daily load curve: morning & evening peak, nighttime low
      let targetCurrent = 1.0;
      if (hour >= 6 && hour <= 8) targetCurrent = 5.0;       // Morning rush (kettle, shower)
      else if (hour >= 18 && hour <= 22) targetCurrent = 7.5; // Evening peak (TV, AC, lights)
      else if (hour >= 1 && hour <= 5) targetCurrent = 0.3;   // Night standby

      const rec = this.engine.step({
        targetCurrent,
        powerFactor: 0.94,
        dtSeconds: stepSeconds,
        timestamp: curEpoch
      });

      recordsChunk.push(rec);

      if (recordsChunk.length >= 20 || i === totalSteps - 1) {
        await this.uploadBatch(recordsChunk);
        sentCount += recordsChunk.length;
        recordsChunk = [];
      }
    }

    console.log(`✓ Acceleration complete! Uploaded ${sentCount} records across ${days} days.\n`);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const dashboardUrl = this.apiBaseUrl.includes('localhost') ? 'http://localhost:3000' : 'https://kwh-meter-pzem004t.vercel.app';
    console.log(`\n======================================================`);
    console.log(`🚀 ESP32 MOCK SIMULATOR STARTED`);
    console.log(`📡 Target Backend : ${this.apiBaseUrl}/api/telemetry`);
    console.log(`🌐 Buka Dashboard : ${dashboardUrl}`);
    console.log(`🆔 Device ID      : ${this.deviceId}`);
    console.log(`⚡ Simulation Mode: [${this.currentMode}] (${SIMULATION_PROFILES[this.currentMode].name})`);
    console.log(`⏱  Sampling / Push : ${this.sampleIntervalMs}ms / ${this.uploadIntervalMs}ms`);
    console.log(`💡 Info           : Buka tautan dashboard di atas pada browser Anda.`);
    console.log(`======================================================\n`);

    this.sampleTimer = setInterval(() => {
      this.sample();
    }, this.sampleIntervalMs);

    this.uploadTimer = setInterval(() => {
      if (this.batchBuffer.length > 0 && this.currentMode !== 'offline') {
        const toSend = [...this.batchBuffer];
        this.batchBuffer = [];
        this.uploadBatch(toSend);
      }
    }, this.uploadIntervalMs);
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.sampleTimer);
    clearInterval(this.uploadTimer);
    console.log('🛑 Simulator stopped.');
  }

  getStatus() {
    return {
      running: this.isRunning,
      mode: this.currentMode,
      profile: SIMULATION_PROFILES[this.currentMode].name,
      bufferedInRAM: this.batchBuffer.length,
      queuedInOffline: this.offlineQueue.length,
      totalBatchesSent: this.totalBatchesSent,
      cumulativeEnergy: this.engine.cumulativeEnergy,
      lastStatus: this.lastUploadStatus
    };
  }
}

// CLI Interactive Runner
async function main() {
  const args = process.argv.slice(2);
  const isHeadless = args.includes('--headless');
  const modeArg = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'normal';
  let targetUrlArg = args.find(a => a.startsWith('http://') || a.startsWith('https://')) || (args[0] && args[0].startsWith('http') ? args[0] : null);

  const options = { mode: modeArg };
  if (targetUrlArg) options.apiBaseUrl = targetUrlArg;

  // Handle direct command: node simulator/index.js accelerate [days] [targetUrl]
  if (args[0] === 'accelerate' || args.includes('--accelerate-30d')) {
    const days = parseInt(args[1] || '30', 10) || 30;
    const sim = new DeviceSimulator(options);
    console.log(`⏩ Running non-interactive acceleration for ${days} days to ${sim.apiBaseUrl}...`);
    await sim.accelerate(days);
    process.exit(0);
  }

  const sim = new DeviceSimulator(options);
  sim.start();

  if (isHeadless) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'SIMULATOR> '
  });

  console.log(`Ketik "help" untuk melihat daftar perintah simulator.\n`);
  rl.prompt();

  rl.on('line', async (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case 'help':
        console.log(`\nPerintah Simulator:`);
        console.log(`  mode <name>        - Ubah mode: normal, high-load, idle, offline, sensor-error, network-failure`);
        console.log(`  normal / high / idle / offline / online / error - Shorthand ubah mode`);
        console.log(`  status             - Tampilkan metrik dan status simulator terkini`);
        console.log(`  accelerate <days>  - Akselerasi waktu N hari (misal: accelerate 30)`);
        console.log(`  reset / reset-energy - Reset register kumulatif kWh sensor ke 0`);
        console.log(`  stop / start       - Hentikan atau mulai kembali simulator`);
        console.log(`  exit / quit        - Keluar dari simulator\n`);
        break;

      case 'normal':
        sim.setMode('normal');
        break;

      case 'high':
      case 'high-load':
        sim.setMode('high-load');
        break;

      case 'idle':
        sim.setMode('idle');
        break;

      case 'offline':
        sim.setMode('offline');
        break;

      case 'online':
        sim.setMode('normal');
        break;

      case 'error':
      case 'sensor-error':
        sim.setMode('sensor-error');
        break;

      case 'mode':
        if (parts[1]) {
          const targetMode = parts[1] === 'high' ? 'high-load' : parts[1] === 'error' ? 'sensor-error' : parts[1];
          sim.setMode(targetMode);
        } else {
          console.log(`Modes: ${Object.keys(SIMULATION_PROFILES).join(', ')}`);
        }
        break;

      case 'status':
        console.log('\nStatus Simulator:', JSON.stringify(sim.getStatus(), null, 2), '\n');
        break;

      case 'accelerate':
        const days = parseInt(parts[1] || '30', 10);
        await sim.accelerate(days);
        break;

      case 'reset':
      case 'reset-energy':
        sim.engine.resetEnergy();
        console.log('✓ Hardware energy register reset to 0.000 kWh');
        break;

      case 'stop':
        sim.stop();
        break;

      case 'start':
        sim.start();
        break;

      case 'exit':
      case 'quit':
        sim.stop();
        process.exit(0);
        break;

      default:
        if (cmd) console.log(`Perintah tidak dikenal: "${cmd}". Ketik "help".`);
        break;
    }
    rl.prompt();
  });
}

if (process.argv[1] && process.argv[1].endsWith('simulator/index.js')) {
  main();
}
