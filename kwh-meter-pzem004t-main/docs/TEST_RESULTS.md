# Automated Test Results: `kwh_meter_pzem004t`

**Date:** 2026-11-03  
**Runner:** Node.js v27 Built-in Test Runner (`node --test`)  
**Status:** **ALL 17 TESTS PASSED (0 FAILURES)**

---

## 1. Test Summary

| Test Suite File | Tests | Passed | Failed | Duration | Focus Area |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tests/validation.test.js` | 4 | 4 | 0 | 3.5 ms | Payload validation, NaN rejection, bounds enforcement |
| `tests/physics.test.js` | 3 | 3 | 0 | 2.5 ms | $P = V \times I \times PF$, $\Delta E$, energy reset |
| `tests/analytics.test.js` | 5 | 5 | 0 | 3.0 ms | Delta energy, rollover, meter reset, Jakarta timezone, summaries |
| `tests/simulator.test.js` | 4 | 4 | 0 | 5.5 ms | Normal, High-Load, Idle, Offline Queue, Error Injection |
| `tests/e2e_ingestion.test.js` | 1 | 1 | 0 | 152.0 ms | HTTP Server Ingestion, Token Auth, Dedup, Status, History, Summary |
| **TOTAL** | **17** | **17** | **0** | **~640 ms** | **100% Pass Rate** |

---

## 2. Detailed Assertions Verified

### 2.1 Backend Boundary & Sanitization Tests
- [x] Valid record accepted with zero errors.
- [x] Reject `NaN` and `Infinity` on any electrical field.
- [x] Reject voltage below 80V or above 260V.
- [x] Reject negative current.
- [x] Reject power factor $> 1.0$ or $< 0.0$.
- [x] Reject empty batch or batches exceeding 50 records.

### 2.2 Electrical Physics Tests
- [x] Verified active power calculation: $P = V \times I \times PF$ within $\pm 0.2\text{W}$ tolerance.
- [x] Verified cumulative energy accumulation: $\Delta E = \frac{P \times \Delta t}{3.600.000}$ conforms to $\sim 1.0\text{ kWh}$ after 1 hour at 1000W load.
- [x] Verified register reset returns energy to $0.000\text{ kWh}$.

### 2.3 Analytics & Rollover Tests
- [x] Monotonic delta energy calculation accurate to 6 decimal places.
- [x] Manual meter reset (e.g. 150 kWh -> 0.002 kWh) handled without negative delta.
- [x] Hardware counter rollover (9999.999 kWh -> 0 kWh) handled accurately.
- [x] Timezone Asia/Jakarta (UTC+7) boundary mapping correctly transitions at 00:00 WIB.
- [x] Daily peak power and electricity cost estimation accurately calculated.

### 2.4 End-to-End Ingestion & Deduplication
- [x] `POST /api/telemetry` with Bearer token accepted (HTTP 200).
- [x] Re-sending same `batchId` returns `{ duplicate: true }` without corrupting totals.
- [x] Unauthorized token rejected (HTTP 401).
- [x] Invalid numeric payload rejected (HTTP 400).
- [x] `/api/device/status` reports device online and reflects last seen epoch.
- [x] `/api/history` returns latest sorted records.
- [x] `/api/summary` computes real-time daily cost and delta energy.
