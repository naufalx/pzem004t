# Data Model & Schema Specification: `kwh_meter_pzem004t`

Dokumen ini mendefinisikan skema data numerik, tipe data, validasi batas, struktur Firebase Realtime Database, dan format payload batch.

---

## 1. Spesifikasi Metrik Kelistrikan & Batas Sensor

| Parameter | Key JSON | Tipe Data | Satuan | Rentang Valid Sensor PZEM | Toleransi / Precision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tegangan** | `voltage` | `float` | Volt ($V$) | $80.0 \sim 260.0$ | Resolusi $0.1\text{ V}$, akurasi $0.5\%$ |
| **Arus** | `current` | `float` | Ampere ($A$) | $0.00 \sim 100.00$ | Resolusi $0.001\text{ A}$, akurasi $0.5\%$ |
| **Daya Aktif** | `activePower` | `float` | Watt ($W$) | $0.0 \sim 23000.0$ | Resolusi $0.1\text{ W}$, akurasi $0.5\%$ |
| **Energi Kumulatif** | `energy` | `float` | kiloWatt-jam ($kWh$) | $0.000 \sim 9999.99$ | Resolusi $1\text{ Wh} = 0.001\text{ kWh}$, rollover pada 9999 kWh |
| **Frekuensi** | `frequency` | `float` | Hertz ($Hz$) | $45.0 \sim 65.0$ | Resolusi $0.1\text{ Hz}$, grid Indonesia $50.0\text{ Hz}$ |
| **Faktor Daya** | `powerFactor` | `float` | Ratio ($\cos\phi$) | $0.00 \sim 1.00$ | Resolusi $0.01$ |
| **Timestamp** | `timestamp` | `integer` | Unix Epoch (detik) | UTC time valid ($\ge 1700000000$) | UTC |
| **Nomor Urut** | `sequence` | `integer` | Counter | $0 \sim 2^{32}-1$ | Monotonik naik per perangkat |

---

## 2. Struktur Payload Batch (Ingestion Contract)

Kontrak data yang wajib dipatuhi oleh **ESP32 Firmware** dan **Mock Simulator**:

```json
{
  "deviceId": "kwh-meter-001",
  "batchId": "b1a2c3d4-e5f6-7890-abcd-1234567890ab",
  "firmwareVersion": "2.0.0",
  "sentAt": 1793600005,
  "records": [
    {
      "timestamp": 1793600001,
      "sequence": 1001,
      "voltage": 220.5,
      "current": 1.25,
      "powerFactor": 0.95,
      "activePower": 261.8,
      "energy": 12.450,
      "frequency": 50.0
    },
    {
      "timestamp": 1793600002,
      "sequence": 1002,
      "voltage": 220.4,
      "current": 1.28,
      "powerFactor": 0.95,
      "activePower": 268.0,
      "energy": 12.451,
      "frequency": 50.0
    },
    {
      "timestamp": 1793600003,
      "sequence": 1003,
      "voltage": 220.6,
      "current": 1.26,
      "powerFactor": 0.95,
      "activePower": 264.1,
      "energy": 12.451,
      "frequency": 50.0
    },
    {
      "timestamp": 1793600004,
      "sequence": 1004,
      "voltage": 220.5,
      "current": 1.25,
      "powerFactor": 0.95,
      "activePower": 261.8,
      "energy": 12.452,
      "frequency": 50.0
    },
    {
      "timestamp": 1793600005,
      "sequence": 1005,
      "voltage": 220.5,
      "current": 1.27,
      "powerFactor": 0.95,
      "activePower": 266.0,
      "energy": 12.453,
      "frequency": 50.0
    }
  ]
}
```

---

## 3. Skema Firebase Realtime Database

```text
kwh-meter/
  devices/
    {deviceId}/
      info/
        deviceName: "KWH Meter Lab Listrik"
        installedAt: "2026-11-03T19:00:00Z"
        tariffPerKwh: 1444.70
        overloadLimitWatt: 2200
      status/
        online: true
        lastSeen: 1793600005
        ipAddress: "192.168.1.50"
        firmwareVersion: "2.0.0"
        rssi: -62
      latest/
        voltage: 220.5
        current: 1.27
        powerFactor: 0.95
        activePower: 266.0
        energy: 12.453
        frequency: 50.0
        timestamp: 1793600005
        sequence: 1005

  history/
    {deviceId}/
      {YYYY-MM-DD}/
        {recordId_timestamp_seq}/
          v: 220.5
          i: 1.27
          p: 266.0
          pf: 0.95
          e: 12.453
          f: 50.0
          t: 1793600005

  summaries/
    {deviceId}/
      daily/
        {YYYY-MM-DD}/
          date: "2026-11-03"
          startEnergy: 12.100
          endEnergy: 14.850
          deltaEnergy: 2.750         // Total konsumsi kWh hari ini
          costEstimated: 3972.93     // deltaEnergy * tariffPerKwh
          peakPower: 1450.2          // Beban puncak (Watt)
          avgPower: 320.5
          minVoltage: 215.2
          maxVoltage: 224.8
          recordCount: 17280
      monthly/
        {YYYY-MM}/
          month: "2026-11"
          totalKwh: 82.50
          totalCost: 119187.75
          peakPower: 1850.0
          daysLogged: 30
      processedBatches/
        {batchId}: 1793600005        // TTL 24 jam untuk deduplikasi
```
