# Troubleshooting & Problem Resolution: `kwh_meter_pzem004t`

Panduan diagnosa dan penanganan kendala umum pada simulator, backend Vercel, Firebase, dan perangkat keras ESP32.

---

## 1. Kendala Simulator & Backend

### 1.1 Simulator Melaporkan `Network Error (fetch failed / ECONNREFUSED)`
- **Penyebab**: Server backend lokal belum berjalan di `http://localhost:3000`.
- **Solusi**: Di terminal terpisah, jalankan `npm start` atau pastikan environment variable `API_BASE_URL` mengarah ke URL server yang aktif (atau URL Vercel).

### 1.2 Ingestion Menghasilkan `HTTP 401 Unauthorized`
- **Penyebab**: `DEVICE_TOKEN` pada simulator atau firmware tidak cocok dengan `DEVICE_TOKEN` di `.env` backend.
- **Solusi**: Samakan nilai token pada `.env` dan `firmware/include/config.h`.

### 1.3 Ingestion Menghasilkan `HTTP 400 VALIDATION_FAILED`
- **Penyebab**: Simulator berada dalam `mode sensor-error`, atau register PZEM fisik membaca nilai di luar batas fisik ($V < 80$, $V > 260$, $PF > 1.0$).
- **Solusi**: Periksa log `details` yang dikembalikan API. Jika pada hardware fisik, periksa kabel CT atau drop tegangan PLN.

---

## 2. Kendala Perangkat Keras ESP32 + PZEM-004T

### 2.1 Nilai Tegangan / Arus Muncul `NaN` pada Serial Monitor
- **Penyebab**: 
  1. Jalur RX/TX terbalik: Ingat bahwa **TX PZEM terhubung ke GPIO16 (RX2 ESP32)** dan **RX PZEM terhubung ke GPIO17 (TX2 ESP32)**.
  2. Sisi tegangan AC PLN belum tersambung ke terminal input PZEM. Modul PZEM-004T membutuhkan catu daya dari jalur AC pengukuran agar sirkuit optocoupler dan chip meteran internalnya aktif.
  3. Ground (GND) antara catu daya ESP32 dan PZEM belum terhubung bersama (*common ground*).
- **Solusi**: Periksa kabel serial dan pastikan terminal AC PZEM mendapatkan suplai 220V dengan prosedur keselamatan listrik yang ketat.

### 2.2 ESP32 Gagal Melakukan Sinkronisasi NTP Waktu
- **Penyebab**: Router atau hotspot memblokir port UDP 123 (NTP).
- **Solusi**: Ganti server NTP di `firmware/src/time_manager.cpp` ke IP lokal atau NTP alternatif seperti `id.pool.ntp.org` / `time.google.com`.

### 2.3 ESP32 Sering Reset Sendiri (Brownout Detector)
- **Penyebab**: Lonjakan arus saat radio Wi-Fi memancarkan sinyal HTTPS menyebabkan tegangan drop pada kabel USB yang tipis.
- **Solusi**: Gunakan adaptor catu daya 5V 2A berkualitas baik dan pasang kapasitor elektrolit 100uF - 470uF pada pin 5V dan GND ESP32.
