/**
 * Energy Analytics & Aggregation Engine
 * Handles cumulative energy delta, meter reset protection, and time-bucket aggregations.
 */

/**
 * Calculates delta energy between previous cumulative energy and current cumulative energy.
 * Handles PZEM-004T counter rollover (9999 kWh -> 0 kWh) and manual meter reset.
 * 
 * @param {number} prevEnergy - Previous cumulative kWh
 * @param {number} currEnergy - Current cumulative kWh
 * @returns {number} Non-negative delta kWh
 */
export function calculateDeltaEnergy(prevEnergy, currEnergy) {
  if (typeof prevEnergy !== 'number' || typeof currEnergy !== 'number') {
    return 0;
  }

  // Normal monotonic increase
  if (currEnergy >= prevEnergy) {
    return parseFloat((currEnergy - prevEnergy).toFixed(6));
  }

  // Case 1: 9999.999 kWh hardware rollover
  if (prevEnergy > 9900.0 && currEnergy < 100.0) {
    const rolloverDelta = (9999.999 - prevEnergy) + currEnergy;
    return parseFloat(rolloverDelta.toFixed(6));
  }

  // Case 2: Meter Reset or PZEM Register Reset (e.g. 50.5 -> 0.0)
  // If currEnergy drops drastically to near zero, treat currEnergy as fresh accumulation from 0
  if (currEnergy < 5.0 && prevEnergy > 10.0) {
    return parseFloat(currEnergy.toFixed(6));
  }

  // Fallback safe delta: avoid negative consumption
  return 0;
}

/**
 * Converts a Unix epoch timestamp (seconds) to Jakarta local Date string (YYYY-MM-DD).
 * Timezone: Asia/Jakarta (UTC+7)
 */
export function getJakartaDateKey(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  // Jakarta is UTC+7
  const utcOffset = 7 * 60 * 60 * 1000;
  const jakartaDate = new Date(d.getTime() + utcOffset);
  const yyyy = jakartaDate.getUTCFullYear();
  const mm = String(jakartaDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jakartaDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts a Unix epoch timestamp (seconds) to Jakarta Month string (YYYY-MM).
 */
export function getJakartaMonthKey(epochSeconds) {
  return getJakartaDateKey(epochSeconds).substring(0, 7);
}

/**
 * Aggregates a batch of records into daily and monthly summaries.
 * 
 * @param {object} currentDailySummary - Existing daily summary or null
 * @param {Array<object>} records - Validated records in this batch
 * @param {number} tariffPerKwh - Electricity tariff per kWh (e.g. 1444.70 IDR)
 */
export function updateDailySummary(currentDailySummary, records, tariffPerKwh = 1444.70) {
  if (!records || records.length === 0) return currentDailySummary;

  const sorted = [...records].sort((a, b) => a.sequence - b.sequence);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const dateKey = getJakartaDateKey(last.timestamp);

  let summary = currentDailySummary ? { ...currentDailySummary } : {
    date: dateKey,
    startEnergy: first.energy,
    endEnergy: last.energy,
    deltaEnergy: 0,
    costEstimated: 0,
    peakPower: 0,
    minVoltage: 260.0,
    maxVoltage: 0.0,
    sumPower: 0,
    recordCount: 0
  };

  for (const r of sorted) {
    const delta = calculateDeltaEnergy(summary.endEnergy, r.energy);
    summary.deltaEnergy = parseFloat((summary.deltaEnergy + delta).toFixed(4));
    summary.endEnergy = r.energy;
    summary.peakPower = Math.max(summary.peakPower, r.activePower);
    summary.maxVoltage = Math.max(summary.maxVoltage, r.voltage);
    summary.minVoltage = Math.min(summary.minVoltage, r.voltage);
    summary.sumPower += r.activePower;
    summary.recordCount += 1;
  }

  summary.avgPower = parseFloat((summary.sumPower / summary.recordCount).toFixed(1));
  summary.costEstimated = parseFloat((summary.deltaEnergy * tariffPerKwh).toFixed(2));

  return summary;
}
