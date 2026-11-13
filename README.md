# ⚡ IoT Smart kWh Meter AC 1-Fasa (ESP32 + PZEM-004T v3.0)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fosiic%2Fkwh-meter-pzem004t&env=DEVICE_TOKEN,FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY,FIREBASE_DATABASE_URL,FIREBASE_API_KEY,FIREBASE_AUTH_DOMAIN,FIREBASE_APP_ID&envDescription=Masukkan%20kredensial%20Firebase%20dan%20Token%20Perangkat%20KWH%20Meter&envLink=https%3A%2F%2Fconsole.firebase.google.com%2F)
[![Tests](https://img.shields.io/badge/Tests-21%20Passing-success)](tests/)
[![Firmware](https://img.shields.io/badge/Firmware-PlatformIO%20ESP32-blue)](firmware/)
[![Cloud](https://img.shields.io/badge/Cloud-Firebase%20RTDB%20%2B%20Vercel-orange)](docs/SYSTEM_ARCHITECTURE.md)
[![MCP](https://img.shields.io/badge/MCP-Firebase%20Server-purple)](.mcp.json)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Sistem pemantauan energi listrik bolak-balik (AC Single-Phase) cerdas kelas produksi berbasis mikrokontroler **ESP32 WROOM-32D DevKit** dan sensor presisi tinggi **PZEM-004T v3.0 TTL**. 

Dilengkapi arsitektur cloud modern (**Vercel Serverless API** + **Firebase Realtime Database**), dashboard web realtime responsif tanpa beban polling, simulator fisika kelistrikan mandiri untuk pengujian tanpa perangkat fisik, integrasi **Firebase MCP (Model Context Protocol)** untuk AI Agent, serta firmware modular C++ berstandar industri dengan proteksi antrean offline RAM & LittleFS.

---

> [!CAUTION]
> **PERINGATAN KESELAMATAN TEGANGAN TINGGI AC (220V - 240V):**
> Sisi AC modul PZEM-004T terhubung langsung ke sumber tegangan PLN berbahaya yang berisiko sengatan fatal. Sisi mikrokontroler (DC 3.3V/5V) terisolasi secara galvanik melalui optocoupler bawaan PZEM. Dilarang keras menghubungkan kabel fase (L) atau netral (N) AC ke pin GPIO ESP32 mana pun. Semua perakitan fisik wajib dilakukan saat MCB utama dalam kondisi mati!

---

## 📑 Daftar Isi

- [Arsitektur Sistem](#-arsitektur-sistem)
- [Fitur Utama](#-fitur-utama)
- [Wiring & Skema Hardware](#-wiring--skema-hardware)
- [Struktur Repositori](#-struktur-repositori)
- [Panduan Memulai Cepat (1-Minute Quickstart)](#-panduan-memulai-cepat-1-minute-quickstart)
- [Simulator Perangkat (Mock ESP32 CLI)](#-simulator-perangkat-mock-esp32-cli)
- [Pengujian Otomatis (Test Suite)](#-pengujian-otomatis-test-suite)
- [Integrasi Firebase MCP Server](#-integrasi-firebase-mcp-server)
- [Deploy ke Vercel & Firebase](#-deploy-ke-vercel--firebase)
- [Flashing Firmware ESP32 (PlatformIO)](#-flashing-firmware-esp32-platformio)
- [Dokumentasi Lengkap](#-dokumentasi-lengkap)

---

## 🏛 Arsitektur Sistem

Arsitektur sistem memisahkan tanggung jawab secara bersih (*separation of concerns*) antara layer akuisisi data, ingestion serverless, database realtime, dan penyajian visual pada antarmuka web:

```mermaid
flowchart TD
    subgraph LayerPerangkat ["1. Layer Perangkat (Hardware / Simulator)"]
        ESP["ESP32 WROOM-32D + PZEM-004T<br/>Sampling Sensor 1s<br/>Ring Buffer RAM 1000 rec<br/>Emergency Flash Spillover<br/>Batch Post HTTPS 5s"]
        SIM["Mock ESP32 Simulator (Node.js)<br/>Model Fisika Kelistrikan AC Riil<br/>6 Mode Beban & Kegagalan<br/>Akselerasi Riwayat 30 Hari"]
    end

    subgraph LayerIngestion ["2. Backend & Ingestion Layer (Vercel API)"]
        API["POST /api/telemetry<br/>Bearer Auth Token<br/>Validasi Batas Fisis Anti-NaN<br/>Deduplikasi Batch UUID<br/>Perhitungan Delta Energi WIB"]
        CONF["GET /api/config<br/>Distribusi Web SDK Safe Config"]
        HIST["GET /api/history<br/>Query Data & Generator CSV"]
        STAT["GET /api/device/status<br/>Watchdog & Heartbeat Online"]
    end

    subgraph LayerCloudDB ["3. Database & Realtime Layer (Firebase RTDB)"]
        RT_LATEST["devices/{id}/latest<br/>Snapshot Telemetri Terkini"]
        RT_STATUS["devices/{id}/status<br/>Status Koneksi & Heartbeat"]
        RT_HIST["history/{id}/{YYYY-MM-DD}/{recordId}<br/>Retensi Data Mentah 30 Hari"]
        RT_SUM["summaries/{id}/daily & monthly<br/>Akumulasi kWh, Biaya, Daya Puncak"]
    end

    subgraph LayerDashboard ["4. Antarmuka Web Dashboard (public/)"]
        STREAM["public/stream.js<br/>Realtime Stream Manager"]
        APP["public/app.js<br/>View & Controller UI"]
        CHART["public/chart.js<br/>Grafik Canvas Bezier Dynamic"]
    end

    ESP -->|"HTTPS POST Batch 5 Detik"| API
    SIM -->|"HTTPS POST Batch Mock"| API
    API -->|"Privileged Admin Write"| RT_LATEST
    API -->|"Privileged Admin Write"| RT_STATUS
    API -->|"Append History Record"| RT_HIST
    API -->|"Update Daily Monthly"| RT_SUM

    RT_LATEST -.->|"Realtime Push onValue"| STREAM
    RT_STATUS -.->|"Realtime Push onValue"| STREAM
    RT_SUM -.->|"Realtime Push onValue"| STREAM
    STREAM --> APP
    APP --> CHART
```

### Keunggulan Desain:
1. **Zero-Polling Frontend**: Browser tidak membebani server/ESP32 dengan request berulang. Data telemetri dipancarkan langsung ke browser via Firebase Realtime Listener (`onValue`).
2. **Hemat Kuota Serverless 80%**: Sensor disampling tiap 1 detik ke dalam circular buffer ESP32 dan dikirim dalam batch per 5 detik (5 record/payload), memangkas kuota serverless dari 2.6 juta eksekusi/bulan menjadi ~518 ribu/bulan.
3. **Ketahanan Jaringan & Proteksi Flash**: Jika WiFi terputus, data diantrekan di RAM (1000 record / ~32KB). Flash LittleFS hanya dipakai saat kondisi darurat pemadaman/putus panjang demi menjaga chip flash ESP32 dari keausan (*wear endurance*).
4. **Idempoten & Proteksi Rollover**: Ingestion mencegah data ganda via UUID deduplication. Komputasi delta energi ($\Delta E$) menangani rollover hardware pada 9999.999 kWh dan reset meter manual tanpa menghasilkan delta negatif.
5. **Deep Module Architecture**: Logika bisnis backend (`lib/ingestion.js`, `lib/storage.js`) dipisahkan total dari adapter transport HTTP (`api/*.js`), menghasilkan arsitektur yang mudah diuji dan dirawat.

---

## ⚡ Fitur Utama

- **Monitoring Real-time Lengkap**: Tegangan ($V$), Arus ($A$), Daya Aktif ($W$), Daya Semu ($VA$), Daya Reaktif ($VAR$), Faktor Daya ($PF$), Frekuensi ($Hz$), dan Energi Kumulatif ($kWh$).
- **Grafik Canvas Ringan**: Visualisasi kurva Bezier real-time dengan gradien halus tanpa dependensi pustaka pihak ketiga (< 3KB).
- **Dual-Mode Backend Storage**: Berjalan otomatis dengan **Firebase Realtime Database** untuk produksi, atau **In-Memory Store** terintegrasi saat dijalankan lokal tanpa setup akun cloud.
- **Simulator Fisika Mandiri**: Mensimulasikan dinamika fisis kelistrikan AC ($P = V \times I \times PF$, $\Delta E = \frac{P \times \Delta t}{3.600.000}$) dengan 6 mode beban dan kegagalan.
- **Akselerasi Riwayat 30 Hari**: CLI simulator mampu menyuntikkan data realistis selama 30 hari ke database dalam beberapa detik.
- **Ekspor Riwayat Data CSV**: Ekspor rekaman riwayat listrik terfilter tanggal dengan format CSV rapi (titik-koma dan UTF-8 BOM untuk Microsoft Excel).

---

## 🔌 Wiring & Skema Hardware

Hubungkan modul **PZEM-004T v3.0** ke **ESP32 WROOM-32D DevKit** pada serial **UART2**:

| Pin PZEM-004T | Pin ESP32 | Keterangan |
| :--- | :--- | :--- |
| **TX** | **GPIO 16 (RX2)** | Jalur Serial Penerima ESP32 |
| **RX** | **GPIO 17 (TX2)** | Jalur Serial Pengirim ESP32 |
| **GND** | **GND** | Common Ground DC |
| **VCC (5V)** | **VIN / 5V** | Catu daya modul optocoupler PZEM |

```text
    +-------------------+                 +-------------------+
    |    ESP32 DEVKIT   |                 |    PZEM-004T V3   |
    |                   |                 |                   |
    |      GPIO16 (RX2) <-----------------+ TX                |
    |      GPIO17 (TX2) +-----------------> RX                |
    |               GND +-----------------+ GND               |
    |          VIN (5V) +-----------------+ 5V (VCC)          |
    +-------------------+                 +---------+---------+
                                                    |
                                      +-------------+-------------+
                                      |   Terminal AC (220V)      |
                                      | L_IN  N_IN  CT_1   CT_2   |
                                      +---------------------------+
                                         |      |     |      |
                                        [Fase] [Netral] [Current Transformer]
```

---

## 📂 Struktur Repositori

```text
kwh_meter_pzem004t/
├── .agents/                 # Ekosistem AI Agent Skills & Plugins
│   ├── plugins/
│   │   └── firebase-mcp/    # Plugin Konfigurasi Firebase MCP Server
│   └── skills/              # 16 Skills Manajemen Proyek, Desain UI, dan Arsitektur
├── .mcp.json                # Konfigurasi Model Context Protocol Tingkat Proyek
├── api/                     # Vercel Serverless Handlers (Adapter Tipis)
│   ├── config.js            # Endpoint distribusi konfigurasi aman Web SDK
│   ├── telemetry.js         # Endpoint utama ingestion telemetri
│   ├── history.js           # Query riwayat telemetri & CSV streaming
│   └── device/
│       └── status.js        # Health check & status online perangkat
├── lib/                     # Modul Inti Domain (Deep Modules)
│   ├── index.js             # Facade ekspor terpadu
│   ├── ingestion.js         # Engine verifikasi token, validasi fisis, deduplikasi & RTDB update
│   ├── storage.js           # Engine query status, riwayat data, format CSV, & agregasi energi
│   ├── validator.js         # Validasi batas fisis fasa tunggal & pencegahan NaN/Infinity
│   ├── analytics.js         # Perhitungan delta energi, timezone WIB, ringkasan harian/bulanan
│   └── firebase.js          # Adapter Firebase Admin SDK & In-Memory Store
├── firmware/                # PlatformIO C++ ESP32 Firmware Modular
│   ├── platformio.ini       # Konfigurasi target esp32dev & penguncian versi library
│   ├── include/             # Header modular (PZEM, WiFi, Queue, NTP, Telemetry)
│   └── src/                 # Implementasi state machine, circular RAM queue, HTTPS client
├── public/                  # Frontend Web Dashboard Modern
│   ├── index.html           # Halaman utama dengan Real-time Canvas Chart
│   ├── real-time.html       # Halaman monitor instan
│   ├── riwayat.html         # Tabel rekaman & tombol ekspor CSV
│   ├── energy.html          # Analitik energi harian/bulanan & estimasi biaya tarif
│   ├── pengaturan.html      # Panel konfigurasi & kalibrasi perangkat
│   ├── tentang.html         # Informasi spesifikasi teknis & panduan K3
│   ├── stream.js            # Realtime Stream Manager (Firebase SDK + REST fallback)
│   ├── app.js               # Controller aplikasi & event binding UI
│   ├── chart.js             # High-performance Bezier Canvas Chart (< 3KB)
│   └── style.css            # Sistem desain UI modern
├── simulator/               # Mock ESP32 Simulator Engine
│   ├── physics.js           # Model komputasi fisis kelistrikan bolak-balik (AC)
│   ├── modes.js             # Definisi 6 mode beban & profil kegagalan jaringan
│   └── index.js             # Antarmuka CLI interaktif & mode injeksi batch headless
├── tests/                   # Rangkaian Uji Otomatis (Node.js Test Runner)
│   ├── validation.test.js   # Uji batas fisis & penolakan nilai invalid
│   ├── physics.test.js      # Uji formula daya aktif & akumulasi energi
│   ├── analytics.test.js    # Uji delta energy, anti-rollover, & timezone WIB
│   ├── simulator.test.js    # Uji transisi beban & buffer antrean offline
│   ├── storage.test.js      # Uji query data, status, & streaming CSV
│   ├── config.test.js       # Uji endpoint konfigurasi publik aman
│   └── e2e_ingestion.test.js# Uji integrasi end-to-end ingestion pipeline
├── database.rules.json      # Aturan Keamanan Firebase Realtime Database
├── server.js                # Server Development Lokal
├── package.json             # Manifest dependensi & script runner
└── README.md                # Dokumentasi utama proyek
```

---

## 🚀 Panduan Memulai Cepat (1-Minute Quickstart)

### 1. Prasyarat
- **Node.js**: Versi 18.x atau lebih baru (direkomendasikan Node 20+ LTS).
- **npm**: Versi 9.x atau lebih baru.

### 2. Instalasi Dependensi
Jalankan di direktori repositori:
```bash
npm install
```

### 3. Menjalankan Dashboard & Server Lokal
```bash
npm start
```
Buka browser di: **`http://localhost:3000`**

> [!TIP]
> Jika berkas `.env` belum diisi kredensial Firebase, backend secara otomatis beralih ke mode **In-Memory Store** lokal sehingga dashboard langsung aktif tanpa konfigurasi tambahan!

---

## 🎛 Simulator Perangkat (Mock ESP32 CLI)

Kembangkan, uji, dan demonstrasikan sistem secara penuh tanpa menghubungkan perangkat ESP32 fisik maupun kabel listrik PLN:

### 1. Menjalankan Simulator Interaktif
Di tab terminal terpisah, jalankan:
```bash
npm run simulator
```

**Perintah Interaktif yang Tersedia:**
- `normal` : Berpindah ke pola konsumsi rumah tangga standar (150W - 1200W).
- `high`   : Mensimulasikan lonjakan beban tinggi (AC + Pemanas Air: 2500W - 3500W).
- `idle`   : Mensimulasikan konsumsi daya siaga/standby (10W - 40W).
- `offline`: Mensimulasikan internet putus (telemetri disimpan ke buffer antrean simulator).
- `online` : Mengembalikan koneksi online dan langsung menyemburkan antrean (*flushing batch*).
- `error`  : Mengirim data sensor korup (`NaN` / tegangan ekstrem) untuk menguji penolakan validasi.
- `reset`  : Mereset register akumulasi energi perangkat kembali ke `0.000 kWh`.
- `quit`   : Keluar dari simulator.

### 2. Akselerasi Data 30 Hari (Time Warp)
Suntikkan data sintetis selama 30 hari ke database cloud atau server lokal dalam hitungan detik:
```bash
node simulator/index.js accelerate 30 http://localhost:3000/api/telemetry
```

---

## 🧪 Pengujian Otomatis (Test Suite)

Repositori ini dilengkapi rangkaian pengujian unit dan integrasi end-to-end menyeluruh menggunakan test runner native Node.js:

```bash
npm test
```

### Matriks Pengujian (21 Tests Passing):
| Modul Uji | Berkas | Deskripsi Verifikasi |
| :--- | :--- | :--- |
| **Validasi Sensor** | `tests/validation.test.js` | Penolakan `NaN`, `Infinity`, tegangan di luar 80-260V, arus negatif, dan payload korup. |
| **Fisika Listrik** | `tests/physics.test.js` | Akurasi formula daya aktif ($P = V \times I \times PF$) dan akumulasi energi ($\Delta E$). |
| **Analitik & Rollover** | `tests/analytics.test.js` | Pemetaan zona waktu Jakarta (WIB), rollover register 9999.999 kWh, dan reset meter manual. |
| **State Simulator** | `tests/simulator.test.js` | Transisi beban `normal`, `high-load`, `idle`, serta buffering antrean `offline`. |
| **Storage & Query** | `tests/storage.test.js` | Pengambilan status online, formatting CSV UTF-8 BOM, dan isolasi penanganan error token. |
| **Konfigurasi Web** | `tests/config.test.js` | Verifikasi endpoint `/api/config` tidak pernah membocorkan `private_key` admin. |
| **E2E Ingestion Pipeline** | `tests/e2e_ingestion.test.js` | Alur penuh POST batch, Bearer auth, deduplikasi UUID batch, dan pembaruan RTDB live. |

---

## 🤖 Integrasi Firebase MCP Server

Proyek ini telah dikonfigurasi dengan standar **Model Context Protocol (MCP)** resmi dari Firebase (`firebase-tools@latest mcp`) pada berkas [`.mcp.json`](.mcp.json) dan [`.agents/plugins/firebase-mcp/mcp_config.json`](.agents/plugins/firebase-mcp/mcp_config.json).

### Cara Kerja:
Server MCP menggunakan autentikasi otomatis `GOOGLE_APPLICATION_CREDENTIALS` dari file Service Account JSON lokal, memberikan akses kepada AI Agent untuk:
1. Memeriksa konfigurasi dan status instans Firebase Realtime Database.
2. Mengaudit dan memvalidasi aturan keamanan `database.rules.json`.
3. Memantau kesehatan backend serverless secara terprogram tanpa login browser interaktif.

---

## ☁️ Deploy ke Vercel & Firebase

### 1. Aturan Keamanan Firebase Realtime Database
Salin isi berkas [`database.rules.json`](database.rules.json) ke menu **Realtime Database > Rules** di Firebase Console:
```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        ".read": true,
        ".write": false
      }
    },
    "summaries": {
      "$deviceId": {
        ".read": true,
        ".write": false
      }
    },
    "history": {
      "$deviceId": {
        ".read": true,
        ".write": false
      }
    }
  }
}
```

### 2. Konfigurasi Environment Variables di Vercel
Tambahkan variabel berikut pada project settings Vercel:
```ini
DEVICE_TOKEN=c8f93e2b1049a8d7e6f5c4b3a2918273645e4d3c2b1a0987f6e5d4c3b2a10987
FIREBASE_PROJECT_ID=kwh-meter-pzem004t
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kwh-meter-pzem004t.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_API_KEY=AIzaSyCpSjMIFShdy-5eAJgGVeRfi2ZwF8tlXng
FIREBASE_AUTH_DOMAIN=kwh-meter-pzem004t.firebaseapp.com
FIREBASE_APP_ID=1:73107839203:web:09521f54e5cb07d6410dd6
```

---

## 📟 Flashing Firmware ESP32 (PlatformIO)

Firmware modern modular berbasis PlatformIO C++ tersedia pada direktori [`firmware/`](firmware/):

1. Buka folder proyek di VS Code yang telah terpasang ekstensi **PlatformIO IDE**.
2. Sesuaikan SSID/Password Wi-Fi pada [`firmware/include/config.h`](firmware/include/config.h):
   ```cpp
   #define DEFAULT_WIFI_SSID "Nama_WiFi_Anda"
   #define DEFAULT_WIFI_PASS "Password_WiFi"
   #define API_HOST          "kwh-meter-pzem004t.vercel.app"
   ```
3. Sambungkan ESP32 DevKit ke port USB komputer.
4. Kompilasi dan upload firmware:
   ```bash
   pio run -t upload
   ```
5. Buka Serial Monitor (115200 baud):
   ```bash
   pio run -t monitor
   ```

---

## 📚 Dokumentasi Lengkap

Spesifikasi arsitektural dan laporan audit terdokumentasi lengkap pada folder [`docs/`](docs/):

- 📐 [**Spesifikasi Arsitektur Sistem** (`docs/SYSTEM_ARCHITECTURE.md`)](docs/SYSTEM_ARCHITECTURE.md): Diagram komponen dan alur data.
- 🔌 [**Spesifikasi Kontrak API** (`docs/API_SPECIFICATION.md`)](docs/API_SPECIFICATION.md): Skema request/response dan status code.
- 💾 [**Model Data Database** (`docs/DATA_MODEL.md`)](docs/DATA_MODEL.md): Struktur pohon Firebase RTDB dan batas fisis.
- ⚙️ [**Desain Firmware Modular** (`docs/FIRMWARE_DESIGN.md`)](docs/FIRMWARE_DESIGN.md): State machine, circular buffer RAM, dan proteksi LittleFS.
- 🖥️ [**Desain Antarmuka Frontend** (`docs/FRONTEND_DESIGN.md`)](docs/FRONTEND_DESIGN.md): Implementasi Canvas chart dan realtime listener.
- 🔒 [**Panduan Keamanan Sistem** (`docs/SECURITY_DESIGN.md`)](docs/SECURITY_DESIGN.md): Proteksi token perangkat dan aturan RTDB.
- 🚀 [**Panduan Deployment Produksi** (`docs/DEPLOYMENT_GUIDE.md`)](docs/DEPLOYMENT_GUIDE.md): Langkah demi langkah deploy Vercel & Firebase.
- 🎮 [**Panduan Simulator Lengkap** (`docs/SIMULATOR_GUIDE.md`)](docs/SIMULATOR_GUIDE.md): Skenario uji beban dan simulasi kegagalan.
- 🧪 [**Rencana & Hasil Uji** (`docs/TEST_PLAN.md`)](docs/TEST_PLAN.md) & [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md): Matriks dan bukti kelulusan pengujian.
- 🛠️ [**Panduan Pemecahan Masalah** (`docs/TROUBLESHOOTING.md`)](docs/TROUBLESHOOTING.md): Diagnosis error serial PZEM, WiFi, dan database.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License**, bebas digunakan, dimodifikasi, dan didistribusikan untuk riset maupun implementasi komersial.
