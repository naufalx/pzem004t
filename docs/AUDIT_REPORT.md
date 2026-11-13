# Comprehensive Technical Audit Report: `kwh_meter_pzem004t`

**Audit Date:** 2026-11-03  
**Auditor:** Senior Full-Stack Engineer, Embedded IoT Architect, Security & QA Auditor  
**Scope:** Firmware (`kwh_meter/kwh_meter.ino`), Frontend Web Assets (`kwh_meter/data/*`), Build & Runtime Tooling, Architecture & Network Stack.

---

## 1. Executive Summary

Audit terhadap repositori lokal `kwh_meter_pzem004t` mengonfirmasi bahwa basis kode saat ini adalah purwarupa sistem pemantauan daya AC satu fasa lokal (*local-only IoT prototype*).
Sistem saat ini bergantung sepenuhnya pada:
1. ESP32 yang merangkap sebagai HTTP Server (port 80) dan WebSocket Server (port 81) unencrypted.
2. Web client yang menyimpan data secara lokal di IndexedDB peramban browser saat browser terbuka.
3. Grafik web yang bersifat statis/mockup SVG tanpa keterikatan data historis real-time.
4. Firmware yang belum memiliki mekanisme sinkronisasi waktu (NTP), antrean offline (*offline queue*), pengiriman HTTPS batch, atau perlindungan validasi data sensor yang aktif.

Target transformasi arsitektur adalah membangun sistem IoT kelas produksi dengan:
- Firmware ESP32 modular dengan HTTPS Batch Telemetry.
- Serverless API Backend (Vercel) dengan validasi ketat, autentikasi perangkat, dan rate limiting.
- Realtime Database (Firebase) dengan listener event-driven (`onValue`, `onChildAdded`) tanpa polling.
- Web Dashboard internet-accessible dengan grafik analitik energi dinamis, filter tanggal, dan agregasi data historis.
- Simulator Mock ESP32 berbasis fisika kelistrikan untuk pengujian end-to-end tanpa memerlukan hardware fisik.

---

## 2. Firmware Audit Findings

### [AUD-FW-01] Validasi Sensor NaN Dinonaktifkan (Commented Out)
- **Severity**: Critical
- **Lokasi**: `kwh_meter/kwh_meter.ino:69-74`
- **Bukti Kode**:
  ```cpp
  // if (isnan(v) || isnan(i) || isnan(p) ||
  //     isnan(e) || isnan(pf) || isnan(f))
  // {
  //     Serial.println("Gagal membaca PZEM-004T. Periksa wiring, suplai, dan koneksi sensor.");
  //     return; // Jangan kirim data simulasi atau data tidak valid
  // }
  ```
- **Dampak**: Jika kabel PZEM putus, baud rate mismatch, atau sensor mati, ESP32 tetap memproses nilai `NaN`. ArduinoJson menserialisasi `NaN` menjadi `null`, menyebabkan korupsi data telemetri di sisi penerima atau kegagalan parsing JSON pada client/backend.
- **Solusi**: Aktifkan validasi `isnan()` pada seluruh 6 parameter PZEM. Bila sensor gagal baca, naikkan counter error, tahan pemancaran payload, dan kirimkan status diagnostik `sensor_error`.
- **Kompleksitas**: Low

---

### [AUD-FW-02] Blocking Connection Loop & Hardcoded Credentials pada Wi-Fi
- **Severity**: High
- **Lokasi**: `kwh_meter/kwh_meter.ino:8-9, 117-122`
- **Bukti Kode**:
  ```cpp
  const char *ssid = "Polinema Hotspot";
  const char *password = "";
  ...
  while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
  }
  ```
- **Dampak**: 
  1. Kredensial Wi-Fi tersimpan mentah (*hardcoded*) di dalam source code publik.
  2. Jika SSID tidak terjangkau, mikrokontroler membeku (*hang*) di dalam loop `while` tanpa batas waktu. Tidak ada watchdog timer, tidak ada fallback ke queue lokal atau Access Point provisioning.
  3. Di dalam `loop()`, tidak ada handler penanganan putus koneksi (*auto-reconnect*). Jika Wi-Fi putus sesaat setelah boot, ESP32 tidak akan pernah tersambung kembali.
- **Solusi**: Implementasikan asynchronous WiFi connection management dengan timeout, state machine non-blocking, auto-reconnect berulang dengan exponential backoff, serta provisioning kredensial via file konfigurasi/NVS.
- **Kompleksitas**: Medium

---

### [AUD-FW-03] Ketiadaan Sinkronisasi Waktu (NTP) dan UTC Epoch Timestamp
- **Severity**: High
- **Lokasi**: `kwh_meter/kwh_meter.ino:85-98`
- **Bukti Kode**:
  ```cpp
  doc["voltage"] = voltage;
  doc["current"] = current;
  ...
  serializeJson(doc, json);
  webSocket.broadcastTXT(json);
  ```
- **Dampak**: Firmware tidak menyertakan timestamp pada data sensor. Client browser saat ini menandai waktu menggunakan jam lokal laptopnya sendiri (`new Date()`). Ketika sistem dipindahkan ke pengiriman cloud (Vercel/Firebase), data historis tidak memiliki stempel waktu kanonikal yang valid.
- **Solusi**: Integrasikan NTP client bawaan ESP32 (`configTime(0, 0, "pool.ntp.org")`), validasi status waktu sebelum pengiriman, dan sematkan UTC Unix timestamp (epoch detik/milidetik) pada setiap record telemetri.
- **Kompleksitas**: Medium

---

### [AUD-FW-04] Alokasi Heap Dinamis JSON & String Berulang (Memory Fragmentation Risk)
- **Severity**: Medium
- **Lokasi**: `kwh_meter/kwh_meter.ino:85, 93-94`
- **Bukti Kode**:
  ```cpp
  JsonDocument doc;
  ...
  String json;
  serializeJson(doc, json);
  ```
- **Dampak**: Membuat objek `String` dan merealokasi buffer JSON setiap 1000ms tanpa reservasi kapasitas di memori stack/static dapat menyebabkan fragmentasi heap memori pada runtime jangka panjang (mingguan/bulanan), yang memicu crash mendadak akibat *out of memory*.
- **Solusi**: Gunakan buffer static `char jsonBuffer[256]` atau `doc.shrinkToFit()` dan minimalkan penggunaan kelas `String` Arduino.
- **Kompleksitas**: Low

---

### [AUD-FW-05] Ketiadaan Client HTTPS Cloud & Local Data Queue
- **Severity**: High
- **Lokasi**: `kwh_meter/kwh_meter.ino`
- **Dampak**: Firmware hanya memiliki WebServer port 80 dan WebSocketsServer port 81 lokal. Tidak ada HTTP Client (khususnya HTTPS dengan TLS) untuk mem-push data ke internet (Vercel API), dan tidak ada buffer/antrean penyimpanan sementara jika internet rumah/lab padam.
- **Solusi**: Bangun modul `TelemetryClient` berbasis `WiFiClientSecure` dan `DataQueue` berbasis RAM ring-buffer dengan fallback ke LittleFS jika offline berkepanjangan.
- **Kompleksitas**: High

---

## 3. Frontend Web Audit Findings

### [AUD-FE-01] Grafik Daya Aktif Menggunakan Mockup SVG Statis
- **Severity**: High
- **Lokasi**: `kwh_meter/data/index.html:47-48`
- **Bukti Kode**:
  ```html
  <svg viewBox="0 0 800 260" preserveAspectRatio="none">
    <polyline points="0,145 35,150 70,140 105,148 140,137 175,150 210,143 245,147 280,140 315,145 350,65 370,138 405,125 440,145 475,137 510,141 545,135 580,143 615,136 650,145 685,139 720,144 760,132 800,140"/>
  </svg>
  <div class="x-labels"><span>22:30</span><span>22:31</span>...</div>
  ```
- **Dampak**: Grafik garis daya aktif pada dashboard utama bukanlah representasi data nyata; garis poligon dan label waktu di bawahnya adalah kode statis HTML mentah. Pengguna mengira grafik berjalan, padahal garis tidak pernah berubah.
- **Solusi**: Ganti dengan canvas/SVG dinamis atau library grafik ringan (seperti Chart.js / uPlot / custom reactive SVG renderer) yang terikat langsung ke stream data Firebase dan histori terkini.
- **Kompleksitas**: Medium

---

### [AUD-FE-02] Metrik Energi Hari Ini, Bulan Ini, dan Tahun Ini Tidak Berfungsi
- **Severity**: Medium
- **Lokasi**: `kwh_meter/data/index.html:52`, `kwh_meter/data/script.js`
- **Bukti Kode**:
  ```html
  <div class="energy-list">
    <div><span>Hari Ini</span><b id="energyToday">-- kWh</b></div>
    <div><span>Bulan Ini</span><b id="energyMonth">-- kWh</b></div>
    <div><span>Tahun Ini</span><b id="energyYear">-- kWh</b></div>
  </div>
  ```
- **Dampak**: Elemen ID `energyToday`, `energyMonth`, dan `energyYear` tidak pernah disentuh atau diperbarui oleh fungsi `updateDashboard(data)` di dalam `script.js`. Nilainya selalu diam pada `-- kWh`.
- **Solusi**: Hitung agregasi energi harian/bulanan di backend (Vercel + Firebase summaries) dan bind datanya melalui Firebase Listener.
- **Kompleksitas**: Medium

---

### [AUD-FE-03] Arsitektur Histori Bergantung Total pada Browser Client (IndexedDB)
- **Severity**: Critical
- **Lokasi**: `kwh_meter/data/script.js:18-52, 234-237`
- **Bukti Kode**:
  ```javascript
  socket.onmessage = (event) => {
      ...
      simpanRiwayat(data).then(...);
  };
  ```
- **Dampak**: Data riwayat hanya dicatat ketika browser web dibuka dan WebSocket tersambung. Jika pengguna menutup laptop atau browser ponsel tertidur di background, pencatatan berhenti total. Ini melanggar fungsi dasar sebuah kWh meter yang wajib mencatat konsumsi energi tanpa jeda 24/7.
- **Solusi**: Pindahkan penyimpanan histori primer ke cloud (Firebase Realtime Database) melalui Vercel API. IndexedDB pada browser hanya dipertahankan sebagai cache offline sekunder bila diperlukan.
- **Kompleksitas**: High

---

## 4. Security Audit Summary

1. **Unencrypted Transport (Cleartext HTTP & WS)**: Firmware menyajikan port 80 (HTTP) dan port 81 (WebSocket) tanpa enkripsi SSL/TLS. Kredensial dan data telemetri rentan intersepsi pada jaringan lokal.
2. **Ketiadaan Autentikasi Pengirim**: Port WebSocket menerima koneksi apa pun di jaringan LAN tanpa token atau API key.
3. **Hardcoded Secrets**: Kredensial Wi-Fi tersimpan dalam plain text di dalam source code firmware.
4. **Public LittleFS Serving**: `server.serveStatic("/", LittleFS, "/");` memaparkan semua file di partisi LittleFS.

---

## 5. Ringkasan Prioritas Audit

| ID | Komponen | Masalah | Tingkat Keparahan | Solusi Utama |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-FW-01** | Firmware | Validasi `isnan()` dimatikan | **CRITICAL** | Wajib aktifkan pengecekan validitas register sensor PZEM |
| **AUD-FE-03** | Frontend/Arsitektur | Histori hanya tersimpan saat browser terbuka | **CRITICAL** | Alihkan pencatatan histori ke Vercel API + Firebase DB |
| **AUD-FW-02** | Firmware | WiFi blocking loop & credentials hardcoded | **HIGH** | State-machine WiFi non-blocking + auto-reconnect |
| **AUD-FW-03** | Firmware | Ketiadaan sinkronisasi waktu NTP & UTC epoch | **HIGH** | Integrasi NTP time synchronization |
| **AUD-FW-05** | Firmware | Ketiadaan HTTPS batch client & offline queue | **HIGH** | Buat TelemetryClient & Local RAM/Flash Queue |
| **AUD-FE-01** | Frontend | Grafik daya aktif berupa SVG statis | **HIGH** | Implementasi dynamic charting berbasis data nyata |
| **AUD-FE-02** | Frontend | Ringkasan energi hari/bulan/tahun tidak aktif | **MEDIUM** | Buat backend aggregation endpoint & data binding |
| **AUD-FW-04** | Firmware | Alokasi heap dynamic berisiko fragmentasi | **MEDIUM** | Optimasi buffer statis memory-safe |
