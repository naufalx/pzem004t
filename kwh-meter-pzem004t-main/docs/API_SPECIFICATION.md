# API Specification: Vercel Serverless Ingestion & Query

Dokumen ini mendefinisikan REST API endpoints yang di-host di Vercel Functions untuk menerima data telemetri dari ESP32/Simulator dan menyajikan data ke dashboard.

---

## 1. Endpoints Overview

| Method | Path | Auth Required | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/telemetry` | Bearer Device Token | Menerima batch telemetri dari ESP32 / Mock Simulator |
| `GET` | `/api/device/status` | Opsional / Public | Mengambil status online, last seen, dan versi firmware |
| `GET` | `/api/history` | Opsional / Public | Mengambil data riwayat terfilter tanggal & jam dengan pagination |
| `GET` | `/api/summary` | Opsional / Public | Mengambil ringkasan konsumsi energi hari ini, bulan ini, & biaya |
| `POST` | `/api/device/settings`| Admin Auth (JWT) | Mengubah tarif listrik, nama device, dan batas alarm |

---

## 2. Ingestion Endpoint: `POST /api/telemetry`

### Headers
```http
Content-Type: application/json
x-device-id: kwh-meter-001
Authorization: Bearer <DEVICE_TOKEN_SECRET>
```

### Request Body
Mengikuti kontrak batch JSON dari `docs/DATA_MODEL.md`.

### Responses
#### Success `200 OK`
```json
{
  "success": true,
  "message": "Batch processed successfully",
  "batchId": "b1a2c3d4-e5f6-7890-abcd-1234567890ab",
  "recordsCount": 5,
  "serverTime": 1793600006
}
```

#### Duplicate Batch `200 OK` (Idempotent)
```json
{
  "success": true,
  "duplicate": true,
  "message": "Batch already processed; skipped insertion",
  "batchId": "b1a2c3d4-e5f6-7890-abcd-1234567890ab"
}
```

#### Unauthorized `401 Unauthorized`
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing device token"
}
```

#### Validation Error `400 Bad Request`
```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "Active power or voltage contains NaN/out of physical bounds",
  "details": [
    "records[2].voltage must be between 80.0 and 260.0"
  ]
}
```

#### Rate Limit Exceeded `429 Too Many Requests`
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many uploads from this device ID. Minimum interval is 3 seconds."
}
```

---

## 3. Query Endpoints

### 3.1 `GET /api/history`
Query parameters:
- `deviceId` (string, required): ID perangkat, e.g. `kwh-meter-001`
- `date` (string, optional): format `YYYY-MM-DD`, default: hari ini
- `limit` (integer, optional): default `100`, max `1000`
- `format` (string, optional): `json` (default) atau `csv`

### 3.2 `GET /api/summary`
Mengambil ringkasan kalkulasi:
```json
{
  "deviceId": "kwh-meter-001",
  "tariffPerKwh": 1444.70,
  "today": {
    "date": "2026-11-03",
    "kwh": 2.75,
    "cost": 3972.93,
    "peakPower": 1450.2,
    "avgPower": 320.5
  },
  "thisMonth": {
    "month": "2026-11",
    "kwh": 82.50,
    "cost": 119187.75
  },
  "lastUpdate": 1793600005
}
```
