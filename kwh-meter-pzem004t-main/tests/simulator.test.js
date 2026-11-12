import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceSimulator } from '../simulator/index.js';

test('Simulator: initializes with default normal mode and generates valid samples', () => {
  const sim = new DeviceSimulator({ apiBaseUrl: 'http://localhost:3000' });
  const sample = sim.sample();

  assert.ok(sample.voltage >= 215 && sample.voltage <= 230);
  assert.ok(sample.activePower > 0);
  assert.equal(sample.frequency >= 49.0 && sample.frequency <= 51.0, true);
  assert.equal(sim.batchBuffer.length, 1);
});

test('Simulator: mode switching to high-load and idle changes current draw', () => {
  const sim = new DeviceSimulator();
  
  sim.setMode('high-load');
  const highSample = sim.sample();
  assert.ok(highSample.current > 6.0, `High load current should be > 6A, got ${highSample.current}A`);
  assert.ok(highSample.activePower > 1200, `High load power should be > 1200W, got ${highSample.activePower}W`);

  sim.setMode('idle');
  const idleSample = sim.sample();
  assert.ok(idleSample.current < 1.0, `Idle current should be < 1A, got ${idleSample.current}A`);
  assert.ok(idleSample.activePower < 150, `Idle power should be < 150W, got ${idleSample.activePower}W`);
});

test('Simulator: offline mode queues records without sending', () => {
  const sim = new DeviceSimulator();
  sim.setMode('offline');

  sim.sample();
  sim.sample();
  sim.sample();

  assert.equal(sim.offlineQueue.length, 3, 'Should hold 3 records in offline queue');
  assert.equal(sim.batchBuffer.length, 0, 'Batch buffer should be empty during offline mode');
});

test('Simulator: sensor-error mode produces invalid numbers for rejection testing', () => {
  const sim = new DeviceSimulator({ mode: 'sensor-error' });
  const badSample = sim.sample();

  assert.ok(Number.isNaN(badSample.voltage), 'Should inject NaN voltage');
  assert.ok(badSample.current < 0, 'Should inject negative current');
});
