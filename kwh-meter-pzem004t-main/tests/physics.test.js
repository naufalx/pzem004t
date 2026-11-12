import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectricalPhysicsEngine } from '../simulator/physics.js';

test('Physics: P = V * I * PF electrical calculation accuracy', () => {
  const engine = new ElectricalPhysicsEngine(10.000);
  const rec = engine.step({
    targetCurrent: 2.0,
    powerFactor: 0.95,
    dtSeconds: 1.0
  });

  const expectedPower = rec.voltage * rec.current * rec.powerFactor;
  const diff = Math.abs(rec.activePower - expectedPower);

  // Active power must equal V * I * PF within 0.2W due to 0.1W rounding
  assert.ok(diff < 0.2, `Active power ${rec.activePower} should match V*I*PF = ${expectedPower}`);
});

test('Physics: cumulative energy accumulation conforms to dE = (P * dt) / 3,600,000', () => {
  const initialEnergy = 10.000;
  const engine = new ElectricalPhysicsEngine(initialEnergy);

  // Step 3600 seconds (1 hour) at constant ~1000W load (4.54A * 220V)
  const dt = 3600;
  const rec = engine.step({
    targetCurrent: 4.545,
    powerFactor: 1.0,
    dtSeconds: dt
  });

  // Expected energy increase in 1 hour at 1000W is ~1.0 kWh
  const delta = rec.energy - initialEnergy;
  assert.ok(delta >= 0.95 && delta <= 1.05, `Expected ~1 kWh delta, got ${delta} kWh`);
});

test('Physics: resets hardware register to 0.000 kWh', () => {
  const engine = new ElectricalPhysicsEngine(25.500);
  engine.resetEnergy();
  const rec = engine.step({});
  assert.ok(rec.energy < 0.05, 'Energy should be reset close to 0');
});
