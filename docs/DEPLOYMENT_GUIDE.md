# Deployment Guide: Vercel, Firebase, & ESP32 Provisioning

Panduan operasional deployment sistem ke cloud production dan flashing firmware perangkat keras.

---

## 1. Setup Firebase Realtime Database

1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru: `kwh-meter-pzem004t`.
2. Masuk ke menu **Build** > **Realtime Database** > Klik **Create Database**.
3. Pilih lokasi regional (disarankan `asia-southeast1` Singapura untuk latensi minimal dari Indonesia).
4. Masuk ke tab **Rules**, tempelkan isi `database.rules.json` dari `docs/SECURITY_DESIGN.md`, lalu klik **Publish**.
5. Buka **Project Settings** > **Service Accounts** > Klik **Generate New Private Key**. Unduh berkas JSON service account.

---

## 2. Setup & Deployment Vercel

1. Buka [Vercel Dashboard](https://vercel.com/) dan import repository `naufalx/kwh_meter_pzem004t`.
2. Di bagian **Environment Variables**, tambahkan:
   - `DEVICE_ID` = `kwh-meter-001`
   - `DEVICE_TOKEN` = (Generate 32+ byte secret)
   - `FIREBASE_DATABASE_URL` = URL dari Firebase Console
   - `FIREBASE_PROJECT_ID` = Project ID Firebase
   - `FIREBASE_CLIENT_EMAIL` = Client email dari service account JSON
   - `FIREBASE_PRIVATE_KEY` = Private key dari service account JSON (pastikan newline `\n` ditangani dengan benar)
3. Klik **Deploy**.
4. Catat URL deployment produksi Vercel (misal: `https://kwh-meter-pzem004t.vercel.app`).

---

## 3. Menjalankan Mock ESP32 Simulator

Simulator dijalankan di komputer/laptop untuk memverifikasi sistem secara instan:
```bash
# Salin konfigurasi environment
cp .env.example .env
# Sesuaikan API_BASE_URL mengarah ke Vercel (atau localhost untuk pengujian lokal)

# Jalankan simulator
npm run simulator
```

---

## 4. Flashing Firmware ke ESP32 Fisik

Jika hardware ESP32 WROOM-32D dan PZEM-004T sudah tersedia:
1. Hubungkan ESP32 ke laptop via kabel data Micro-USB.
2. Konfigurasi kredensial WiFi dan Vercel API URL di `firmware/include/config.h`.
3. Build dan flash firmware:
   ```bash
   pio run --target upload
   ```
4. Buka Serial Monitor (115200 baud) untuk melihat log NTP sync dan pengiriman batch HTTPS.
