import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeltaEnergy, getJakartaDateKey, updateDailySummary } from '../lib/analytics.js';

test('Analytics: delta energy calculation on normal monotonic increment', () => {
  const delta = calculateDeltaEnergy(12.450, 12.455);
  assert.equal(delta, 0.005);
});

test('Analytics: handles hardware meter reset without negative delta', () => {
  // Meter was at 150.0 kWh, user performed manual reset on hardware PZEM to 0.002 kWh
  const delta = calculateDeltaEnergy(150.000, 0.002);
  assert.equal(delta, 0.002, 'Should treat fresh reset as accumulation from 0');
});

test('Analytics: handles 9999.999 kWh counter rollover', () => {
  const delta = calculateDeltaEnergy(9999.990, 0.015);
  // (9999.999 - 9999.990) + 0.015 = 0.009 + 0.015 = 0.024
  assert.ok(Math.abs(delta - 0.024) < 0.001);
});

test('Analytics: timezone Jakarta (UTC+7) Date Key mapping', () => {
  // 2026-11-03 18:30:00 UTC = 2026-11-04 01:30:00 Jakarta
  const epoch = Date.UTC(2026, 10, 3, 18, 30, 0) / 1000;
  const dateKey = getJakartaDateKey(epoch);
  assert.equal(dateKey, '2026-11-04', 'Should correctly wrap to next day in Jakarta timezone');
});

test('Analytics: aggregates batch into daily summary with peak power and estimated cost', () => {
  const records = [
    { timestamp: 1793600000, sequence: 101, voltage: 220.0, current: 2.0, activePower: 440.0, powerFactor: 1.0, energy: 10.000, frequency: 50.0 },
    { timestamp: 1793600005, sequence: 102, voltage: 222.0, current: 5.0, activePower: 1100.0, powerFactor: 1.0, energy: 10.002, frequency: 50.0 }
  ];

  const summary = updateDailySummary(null, records, 1444.70);
  assert.equal(summary.peakPower, 1100.0);
  assert.equal(summary.maxVoltage, 222.0);
  assert.equal(summary.minVoltage, 220.0);
  assert.equal(summary.deltaEnergy, 0.002);
  assert.ok(summary.costEstimated > 0);
});
