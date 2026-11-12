/**
 * Simulation Mode Profiles & Network Emulation
 */

export const SIMULATION_PROFILES = {
  normal: {
    name: 'Normal Load',
    targetCurrent: 1.8,    // ~375W load (laptop, fan, LED lighting, fridge idle)
    powerFactor: 0.95,
    errorRate: 0.0
  },
  'high-load': {
    name: 'High Load',
    targetCurrent: 8.5,    // ~1800W load (air conditioner, microwave, kettle)
    powerFactor: 0.92,
    errorRate: 0.0
  },
  idle: {
    name: 'Idle / Standby',
    targetCurrent: 0.25,   // ~50W load (standby routers, chargers, night lights)
    powerFactor: 0.88,
    errorRate: 0.0
  },
  'sensor-error': {
    name: 'Sensor Failure Injection',
    targetCurrent: 1.5,
    powerFactor: 0.95,
    errorRate: 1.0        // Injects NaN / null / out-of-bounds to test backend rejection
  },
  offline: {
    name: 'Network Offline / Queue Buffer',
    targetCurrent: 1.8,
    powerFactor: 0.95,
    errorRate: 0.0,
    isOffline: true
  },
  'network-failure': {
    name: 'Server Network Failure',
    targetCurrent: 1.8,
    powerFactor: 0.95,
    errorRate: 0.0,
    failHttp: true
  }
};
