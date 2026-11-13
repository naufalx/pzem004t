# Security & Vulnerability Audit Report: `kwh_meter_pzem004t`

Laporan evaluasi keamanan sistem, vektor serangan potensial, dan rencana mitigasi keamanan IoT.

---

## 1. Analisis Vektor Kerentanan Sistem Saat Ini

| ID Vektor | Kategori | Komponen | Deskripsi Kerentanan | Tingkat Risiko |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Information Disclosure | Firmware | Kredensial SSID & Password Wi-Fi tersimpan mentah (*plaintext*) di dalam source code publik. | **HIGH** |
| **SEC-02** | Unauthenticated Transport | WebSocket | WebSocket Server port 81 terbuka untuk seluruh perangkat di LAN tanpa mekanisme token autentikasi atau handshake secret. | **HIGH** |
| **SEC-03** | Cleartext Communication | HTTP/WS | Komunikasi port 80 dan port 81 tidak terenkripsi TLS. Data konsumsi energi dan pola aktivitas pengguna dapat disadap (*packet sniffing*). | **MEDIUM** |
| **SEC-04** | Denial of Service (DoS) | Firmware | Loop `while(WiFi.status() != WL_CONNECTED)` menyebabkan ESP32 hang permanen bila AP mati. | **HIGH** |
| **SEC-05** | Unauthorized Reset | Hardware | Prosedur reset energi register hardware PZEM dapat dipicu siapa saja jika endpoint kontrol web diimplementasikan tanpa otorisasi. | **HIGH** |

---

## 2. Standar Keamanan Target Arsitektur Cloud (Vercel + Firebase)

Dalam target arsitektur baru, berikut adalah aturan keamanan yang wajib ditegakkan:

### 2.1 Keamanan Firmware & Perangkat Fisik
1. **Device Pre-shared Secret / Bearer Token**: Setiap ESP32 (dan simulator) memegang `DEVICE_ID` dan `DEVICE_TOKEN` acak dengan entropi tinggi (32-karakter hexa).
2. **HTTPS Strict Transport Security**: Komunikasi data dari ESP32 ke Vercel API wajib menggunakan HTTPS port 443 dengan validasi sertifikat SSL/TLS root CA. Dilarang menggunakan `client.setInsecure()` sebagai solusi akhir produksi.
3. **Penyimpanan Kredensial Aman**: Token dan Wi-Fi disimpan di partisi NVS / file konfigurasi yang di-ignore oleh `.gitignore`.

### 2.2 Keamanan Backend Serverless (Vercel API)
1. **Validasi Header Autentikasi**: Endpoint `POST /api/telemetry` wajib memeriksa `x-device-token` atau `Authorization: Bearer <TOKEN>`.
2. **Rate Limiting**: Mencegah serangan brute-force atau flooding dari perangkat yang terkompromi (misal: maksimum 1 request per 3 detik per device ID).
3. **Payload Sanitization & Boundary Check**:
   - Menolak nilai `NaN`, `Infinity`, atau null.
   - Menolak nilai tegangan di luar batas fisik realistis ($0 \le V \le 300$).
   - Menolak nilai arus negatif atau melampaui rating sensor ($0 \le I \le 100$).
   - Menolak timestamp yang berselisih lebih dari $\pm 1$ jam dari waktu server.
4. **Isolasi Service Account Firebase**: Kredensial `FIREBASE_PRIVATE_KEY` dan `FIREBASE_CLIENT_EMAIL` hanya boleh berada di environment server Vercel, tidak pernah dibocorkan ke client bundle.

### 2.3 Keamanan Basis Data (Firebase Realtime Database)
1. **No Public Write Access**: Seluruh izin tulis publik (`".write": true`) ditolak secara mutlak pada Firebase Security Rules. Hanya Backend Vercel via Firebase Admin SDK yang memiliki hak menulis (*privileged write*).
2. **Granular Read Access**: Pembacaan data oleh web dashboard diamankan dengan Firebase Authentication:
   ```json
   {
     "rules": {
       "devices": {
         "$deviceId": {
           ".read": "auth != null",
           ".write": false
         }
       }
     }
   }
   ```
3. **CORS Hardening**: Endpoint API hanya mengizinkan origin dashboard resmi.
