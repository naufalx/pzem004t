# Test Plan & Quality Assurance: `kwh_meter_pzem004t`

Rencana pengujian komprehensif yang mencakup unit test, integration test, simulasi fisika, dan evaluasi performa.

---

## 1. Lingkup Pengujian

```text
[Unit Tests]
 ├── Backend Payload & Bounds Sanitizer (test/backend/validation.test.js)
 ├── Ingestion Deduplication Logic (test/backend/dedup.test.js)
 ├── Delta Energy & Tariff Accumulator (test/backend/analytics.test.js)
 └── Simulator Physics Calculations (test/simulator/physics.test.js)

[Integration & End-to-End Tests]
 ├── Simulator CLI -> Vercel Local Ingestion API (test/e2e/ingestion.test.js)
 ├── Offline Queue Flush & Retry Verification (test/simulator/offline.test.js)
 └── 30-Day Accelerated Time & Monthly Summary Verification

[Frontend UI & Realtime Tests]
 ├── Firebase Realtime Listener Initialization & Teardown
 ├── Canvas Dynamic Chart Rendering Integrity
 └── CSV Exporter Column & Formatting Verification
```

---

## 2. Kriteria Kelulusan (Pass Criteria)

1. **Backend Validation**:
   - $100\%$ payload dengan `NaN`, `Infinity`, tegangan $< 80\text{V}$ atau $> 260\text{V}$, dan arus negatif wajib ditolak dengan HTTP 400.
   - Batch dengan token salah atau kosong wajib ditolak dengan HTTP 401.
   - Batch duplikat dengan `batchId` yang sama wajib diabaikan secara idempoten (HTTP 200).
2. **Simulator Physics Consistency**:
   - $P \approx V \times I \times PF$ dengan toleransi $\pm 0.5\%$.
   - $\Delta E = \frac{P \times \Delta t}{3.600.000}\text{ kWh}$.
3. **Data Integrity**:
   - Nilai kumulatif energi PZEM tidak pernah dijumlahkan secara naif; konsumsi selalu dihitung dari $\Delta E$.
   - Meter reset (saat energi kembali ke 0.000) ditangani tanpa menghasilkan delta negatif atau merusak akumulasi bulanan.
