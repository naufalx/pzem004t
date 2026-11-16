# Technical Debt Report: `kwh_meter_pzem004t`

Daftar utang teknis (*technical debt*), inefisiensi, dan potensi titik kegagalan yang diidentifikasi dalam basis kode saat ini.

---

## 1. Firmware Monolithic Architecture

- **Hutang Teknis**: Seluruh logika perangkat keras, Wi-Fi, LittleFS, Web Server, WebSocket Server, dan formatting data ditulis dalam satu file tunggal `kwh_meter.ino` (176 baris).
- **Dampak**: 
  - Sulit diuji secara unit test (*untestable*).
  - Tidak ada pemisahan tanggung jawab (*Separation of Concerns*).
  - Menghambat penambahan fitur antrean offline, retry HTTPS, atau enkripsi TLS tanpa merusak logika lain.
- **Solusi Rekomendasi**: Refactor menjadi modul terpisah:
  - `config.h` (pinout, timing, buffer limits)
  - `pzem_manager.h/.cpp` (hardware acquisition, sanitasi NaN, error counter)
  - `wifi_manager.h/.cpp` (non-blocking connection, reconnect backoff)
  - `time_manager.h/.cpp` (NTP sync, UTC epoch generation)
  - `data_queue.h/.cpp` (ring buffer RAM + flash spillover)
  - `telemetry_client.h/.cpp` (HTTPS POST batch uploader)

---

## 2. Hardcoded Credentials & Security Smells

- **Hutang Teknis**: Kredensial jaringan (`ssid = "Polinema Hotspot"`, `password = ""`) tertanam langsung dalam firmware.
- **Dampak**: Firmware harus di-compile ulang setiap kali berganti Wi-Fi; kredensial berisiko bocor saat source code di-push ke git.
- **Solusi Rekomendasi**: Implementasikan provisioning berbasis WiFiManager / Web Captive Portal atau penyimpanan kredensial terenkripsi di ESP32 NVS (Non-Volatile Storage).

---

## 3. Client-Centric Data Ingestion & Loss of Telemetry

- **Hutang Teknis**: Desain sistem meletakkan beban persistensi data historis pada peramban web pengguna (IndexedDB) melalui WebSocket lokal.
- **Dampak**: 
  - Kehilangan data sebesar 90%+ dari total waktu operasi, karena browser hanya dibuka sewaktu-waktu.
  - Perhitungan konsumsi energi harian/bulanan tidak akurat karena sampel terputus-putus.
- **Solusi Rekomendasi**: Backend ingestion mandiri di Vercel yang menerima HTTPS batch dari ESP32/Simulator dan menyimpannya langsung ke Firebase Realtime Database.

---

## 4. Front-End DOM & Script Redundancy

- **Hutang Teknis**: `script.js` berisi 399 baris kode dengan fungsi ganda yang menyentuh DOM secara repetitif (`setText("voltage", ...)`, `setText("tVoltage", ...)`, `setText("energyVoltage", ...)`).
- **Dampak**: Pembaruan struktur HTML mudah merusak rendering karena tingginya kopling (*tight coupling*) antara ID elemen dan logika JavaScript.
- **Solusi Rekomendasi**: Buat state management terpadu yang memetakan snapshot data Firebase ke view komponen secara terorganisir.

---

## 5. Ketiadaan Build System Standar (PlatformIO / CMake)

- **Hutang Teknis**: Repositori saat ini hanya menyediakan sketch `.ino` tanpa konfigurasi `platformio.ini` atau `arduino-cli sketch.yaml`.
- **Dampak**: Dependensi library (`PZEM004Tv30`, `ArduinoJson`, `WebSocketsServer`) harus diinstal manual oleh pengembang lain melalui Arduino IDE GUI, menyebabkan ketidakkonsistenan versi (ArduinoJson 6 vs 7).
- **Solusi Rekomendasi**: Sediakan konfigurasi `platformio.ini` lengkap yang mengunci versi dependency, konfigurasi partisi LittleFS, dan flags compiler.
