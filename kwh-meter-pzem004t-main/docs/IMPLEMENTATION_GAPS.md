# Implementation Gaps Analysis: `kwh_meter_pzem004t`

Perbandingan antara kondisi implementasi lokal saat ini (*Current State*) dan spesifikasi sistem target (*Target Architecture*).

---

## 1. Matriks Gap Analisis

| Fitur / Komponen | Kondisi Aktual (Current State) | Target Arsitektur Baru | Status Gap |
| :--- | :--- | :--- | :--- |
| **Ingestion Pipeline** | WebSocket lokal port 81 (LAN only) | HTTPS POST Batch Upload ke Vercel Serverless API | **BELUM ADA** |
| **Data Persistence** | IndexedDB lokal di browser klien | Firebase Realtime Database (History & Summaries) | **BELUM ADA** |
| **Realtime Distribution** | Broadcast WS unencrypted lokal | Firebase Web SDK Realtime Listener (`onValue`) | **BELUM ADA** |
| **Offline Data Queue** | Tidak ada (data hilang jika WS putus) | Ring-buffer RAM + LittleFS Flash Buffer | **BELUM ADA** |
| **Timestamp & NTP** | Mengandalkan jam lokal laptop klien | NTP Sync di ESP32 dengan UTC Unix Timestamp | **BELUM ADA** |
| **Device Simulator** | Tidak ada (harus pakai hardware) | Mock ESP32 Simulator berbasis Node.js/CLI | **BELUM ADA** |
| **Energy Analytics** | Ringkasan Hari/Bulan/Tahun tidak aktif | Agregasi konsumsi delta kWh per jam/hari/bulan | **BELUM ADA** |
| **Dynamic Charting** | Mockup SVG poligon statis | Grafik interaktif real-time terikat data asli | **BELUM ADA** |
| **Device Authentication** | Tidak ada | Bearer Token & Device ID validation di API | **BELUM ADA** |
| **Build Configuration** | Sketch tunggal `.ino` manual | PlatformIO project structure & locked deps | **BELUM ADA** |

---

## 2. Rincian Kebutuhan Implementasi Baru

### 2.1 Backend Layer (Vercel Serverless API)
- Framework: Node.js / Next.js API Routes atau Express-compatible serverless functions.
- Endpoints:
  - `POST /api/telemetry`: Menerima batch data dari ESP32 & Simulator, validasi token, validasi numerik, tulis ke Firebase RTDB (`latest/`, `history/`, update `summaries/`).
  - `GET /api/device/status`: Mengambil status konektivitas, firmware version, dan heartbeat terakhir.
  - `GET /api/history`: Mengambil riwayat terfilter dengan pagination untuk kebutuhan ekspor atau tabel web.
  - `GET /api/summary`: Mengambil ringkasan konsumsi energi (hari ini, bulan ini, tahun ini, estimasi biaya).

### 2.2 Database Layer (Firebase Realtime Database)
- Schema terstruktur:
  - `devices/{deviceId}/status`: online, lastSeen, ipAddress, firmwareVersion.
  - `devices/{deviceId}/latest`: telemetry snapshot terkini untuk dashboard cards.
  - `history/{deviceId}/{YYYY-MM-DD}/{recordId}`: record rinci per batch.
  - `summaries/{deviceId}/daily/{YYYY-MM-DD}`: total kWh hari ini, peak watt, avg watt, min volt, max volt.
  - `summaries/{deviceId}/monthly/{YYYY-MM}`: akumulasi bulanan dan estimasi tagihan PLN.

### 2.3 Simulator Layer (Mock ESP32 CLI)
- Node.js CLI script: `npm run simulator`.
- Kemampuan:
  - Generator data fisika konsisten: $P \approx V \times I \times PF$, $\Delta E = \frac{P \times \Delta t}{3.600.000}$.
  - Mode operasi: `normal`, `high-load`, `idle`, `offline`, `sensor-error`, `network-failure`, `restart`.
  - Accelerated time mode: Simulasi kompresi waktu 30 hari untuk verifikasi agregasi bulanan dalam hitungan menit.

### 2.4 Frontend Refactor Layer
- Mempertahankan estetika *dark theme* dan tata letak navigasi yang sudah baik.
- Mengganti WebSocket connection logic dengan Firebase Web SDK v10 (modular).
- Mengganti SVG chart statis dengan dynamic chart.
- Menghubungkan kartu `energyToday`, `energyMonth`, `energyYear` ke node `summaries/`.
- Memperbarui filter tanggal dan jam pada halaman `riwayat.html` untuk query Firebase.

### 2.5 Firmware Refactor Layer
- Struktur modular berbasis PlatformIO (`src/`, `include/`).
- Integrasi `WiFiClientSecure` untuk upload HTTPS ke Vercel API.
- Mekanisme batch buffer (misal: baca sensor tiap 1 detik, kirim batch 5 sampel tiap 5 detik).
- Offline storage buffer agar data tidak hilang saat WiFi terputus.
