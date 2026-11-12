/**
 * Validation engine for KWH Meter Telemetry Payloads
 * Strictly enforces physical bounds, NaN/Infinity rejection, and batch structure.
 */

export const BOUNDS = {
  voltage: { min: 80.0, max: 260.0 },       // AC Volts
  current: { min: 0.0, max: 100.0 },        // AC Amperes
  activePower: { min: 0.0, max: 23000.0 },   // Watts (max 100A * 230V)
  powerFactor: { min: 0.0, max: 1.0 },      // Ratio
  frequency: { min: 45.0, max: 65.0 },      // Hertz (Grid 50Hz)
  energy: { min: 0.0, max: 9999.999 }       // Cumulative kWh
};

/**
 * Validates a single telemetry record.
 * @param {object} record 
 * @param {number} index
 * @returns {string|null} Error message or null if valid
 */
export function validateRecord(record, index = 0) {
  if (!record || typeof record !== 'object') {
    return `records[${index}] must be a non-null object`;
  }

  const { timestamp, sequence, voltage, current, activePower, powerFactor, frequency, energy } = record;

  if (typeof timestamp !== 'number' || !Number.isInteger(timestamp) || timestamp < 1700000000) {
    return `records[${index}].timestamp must be a valid UTC unix epoch timestamp (seconds)`;
  }

  if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 0) {
    return `records[${index}].sequence must be a non-negative integer`;
  }

  for (const [key, bound] of Object.entries(BOUNDS)) {
    const val = record[key];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return `records[${index}].${key} must be a finite number (received: ${val})`;
    }
    if (val < bound.min || val > bound.max) {
      return `records[${index}].${key} value ${val} is outside physical bounds [${bound.min}, ${bound.max}]`;
    }
  }

  return null;
}

/**
 * Validates a full batch payload.
 * @param {object} payload 
 * @returns {{ valid: boolean, error?: string, details?: string[] }}
 */
export function validateBatchPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be a non-null JSON object' };
  }

  const { deviceId, batchId, firmwareVersion, records } = payload;

  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    return { valid: false, error: 'deviceId is required and must be a non-empty string' };
  }

  if (!batchId || typeof batchId !== 'string' || batchId.trim().length === 0) {
    return { valid: false, error: 'batchId is required and must be a unique non-empty string' };
  }

  if (!firmwareVersion || typeof firmwareVersion !== 'string') {
    return { valid: false, error: 'firmwareVersion is required' };
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { valid: false, error: 'records must be a non-empty array' };
  }

  if (records.length > 50) {
    return { valid: false, error: 'records array exceeds maximum batch size of 50 items' };
  }

  const errors = [];
  for (let i = 0; i < records.length; i++) {
    const err = validateRecord(records[i], i);
    if (err) errors.push(err);
  }

  if (errors.length > 0) {
    return { valid: false, error: 'Record validation failed', details: errors };
  }

  return { valid: true };
}
