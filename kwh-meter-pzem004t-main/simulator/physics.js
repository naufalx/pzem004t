/**
 * Physics Engine for Mock PZEM-004T AC Energy Sensor
 * Implements strict electrical AC single-phase relationships:
 * P = V * I * PF
 * dE = (P * dt) / 3,600,000 kWh
 */

export class ElectricalPhysicsEngine {
  constructor(initialEnergy = 10.000) {
    this.cumulativeEnergy = initialEnergy;
    this.sequence = 1000;
  }

  /**
   * Generates a physically consistent AC telemetry reading.
   * 
   * @param {object} options
   * @param {number} options.targetCurrent - Target current in Amperes
   * @param {number} options.powerFactor - Power factor (0.00 - 1.00)
   * @param {number} options.dtSeconds - Time step in seconds (default 1.0)
   * @param {number} [options.timestamp] - Specific UTC epoch (seconds), default Date.now()
   * @returns {object} Telemetry record
   */
  step({ targetCurrent = 1.5, powerFactor = 0.95, dtSeconds = 1.0, timestamp = null }) {
    this.sequence += 1;
    const nowEpoch = timestamp !== null ? timestamp : Math.floor(Date.now() / 1000);

    // AC Grid voltage nominal 220V with realistic slight noise (+- 2.5V)
    const voltageNoise = (Math.random() - 0.5) * 5.0;
    const voltage = parseFloat((220.0 + voltageNoise).toFixed(1));

    // Current jitter (+- 2%)
    const currentJitter = targetCurrent * (1.0 + (Math.random() - 0.5) * 0.04);
    const current = parseFloat(Math.max(0.01, currentJitter).toFixed(3));

    // Power factor (+- 0.01) clamped between 0.20 and 1.00
    const pfJitter = powerFactor + (Math.random() - 0.5) * 0.02;
    const pf = parseFloat(Math.min(1.0, Math.max(0.2, pfJitter)).toFixed(2));

    // Frequency nominal 50.0 Hz (+- 0.15 Hz)
    const frequency = parseFloat((50.0 + (Math.random() - 0.5) * 0.3).toFixed(1));

    // P = V * I * PF
    const activePower = parseFloat((voltage * current * pf).toFixed(1));

    // dE = (P * dt) / 3,600,000 kWh
    const deltaEnergy = (activePower * dtSeconds) / 3600000.0;
    this.cumulativeEnergy = parseFloat((this.cumulativeEnergy + deltaEnergy).toFixed(6));

    // PZEM 9999.999 kWh rollover
    if (this.cumulativeEnergy > 9999.999) {
      this.cumulativeEnergy = 0.001;
    }

    return {
      timestamp: nowEpoch,
      sequence: this.sequence,
      voltage,
      current,
      powerFactor: pf,
      activePower,
      energy: parseFloat(this.cumulativeEnergy.toFixed(3)),
      frequency
    };
  }

  /**
   * Resets hardware cumulative energy register to zero.
   */
  resetEnergy() {
    this.cumulativeEnergy = 0.000;
  }
}
