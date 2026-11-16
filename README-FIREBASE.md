# KWH Meter — Firebase-only

Versi ini mempertahankan file HTML/CSS dashboard asli. Vercel API/serverless dihapus;
website dilayani Firebase Hosting dan ESP32 menulis telemetri langsung ke Firebase RTDB.

## Struktur sederhana
- `public/` — website (HTML/CSS asli + JS Firebase)
- `firmware/` — project PlatformIO ESP32
- `database.rules.json` — aturan akses RTDB
- `firebase.json` — konfigurasi Firebase Hosting + Database

## 1. Aktifkan Firebase Authentication
Di Firebase Console:
1. Buka **Authentication → Sign-in method**.
2. Aktifkan **Anonymous**.
3. Pastikan project yang dipakai adalah `kwh-meter-pzem004t`.

ESP32 melakukan anonymous sign-in melalui Firebase Identity Toolkit, menyimpan refresh token
di RAM, dan memperbarui ID token sebelum kedaluwarsa. Tidak perlu menaruh service-account key
atau database secret di firmware.

## 2. Atur Realtime Database
Database URL yang dipakai:
`https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app`

Deploy rules dari folder proyek:
```bash
firebase login
firebase use --add
firebase deploy --only database
```
Rules mengizinkan pembacaan dashboard dan mensyaratkan autentikasi Firebase untuk penulisan.
Karena dashboard dibaca publik, jangan simpan data rahasia pada path telemetri.

## 3. Upload website ke Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting
```
Folder yang di-host adalah `public/`. Tidak ada Vercel, Node server, API routes, maupun
environment variables server yang dibutuhkan.

## 4. Upload firmware
Buka folder `firmware/` dengan VS Code + PlatformIO, atur Wi-Fi di:
`firmware/include/config.h`
```cpp
#define DEFAULT_WIFI_SSID "NAMA_WIFI"
#define DEFAULT_WIFI_PASS "PASSWORD_WIFI"
```
Lalu build dan upload ke ESP32. Pin PZEM tetap GPIO16 (RX2) dan GPIO17 (TX2).
Serial Monitor 115200 baud. Log yang diharapkan:
- `[Firebase Auth] Anonymous authentication successful.`
- `[Firebase] Upload berhasil: ... record tersinkronisasi.`

## 5. Struktur data RTDB
- `devices/kwh-meter-001/latest` — data terbaru
- `devices/kwh-meter-001/status` — heartbeat ESP32
- `history/kwh-meter-001/YYYY-MM-DD/<timestamp>_<sequence>` — rekaman

## Catatan penting
- Firebase API key Web bukan rahasia; keamanan penulisan dijaga oleh Firebase Authentication
  dan RTDB Rules. Jangan pernah memasukkan service-account private key ke firmware/browser.
- Jika Authentication Anonymous belum aktif, ESP32 tidak dapat menulis ke database.
- Perubahan ini mempertahankan tampilan HTML/CSS. Halaman yang sebelumnya meminta endpoint
  Vercel untuk fitur ringkasan/ekspor/riwayat lama perlu migrasi query khusus RTDB lanjutan;
  streaming dashboard real-time utama menggunakan listener Firebase langsung.
- Firmware memakai TLS `setInsecure()` seperti program sumber. Untuk deployment permanen,
  sebaiknya pasang root CA certificate agar verifikasi sertifikat aktif.
