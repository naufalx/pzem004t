# Frontend Design & Realtime Integration: `kwh_meter_pzem004t`

Rancangan antarmuka web, integrasi Firebase Realtime Listener, dynamic charting, dan state management.

---

## 1. Arsitektur Frontend

- **Hosting**: Vercel (atau static hosting apa pun).
- **Teknologi**: Modern Native JavaScript ES Modules / HTML5 / CSS3 (tanpa bloatware framework berat).
- **Realtime Layer**: Firebase Web SDK v10 (modular) langsung terhubung ke node `devices/{deviceId}/latest` via `onValue()`.
- **Sistem Desain**: Mengacu pada `DESIGN.md` (mode: `Operate`, dark palette `#070e17`, aksen semantik, tabular numerals).

---

## 2. Dynamic Charting Architecture

Menggantikan poligon SVG statis pada `index.html` dan `real-time.html`:
- Menggunakan renderer canvas berbasis waktu (*time-series canvas chart*) berbobot ringan (< 5 KB tanpa dependensi eksternal).
- Rentang waktu:
  - 1 Menit (resolusi 1 detik, 60 titik data)
  - 5 Menit (resolusi 5 detik, 60 titik data)
  - 1 Jam (resolusi 1 menit, 60 titik data)
- Garis grafik me-render kurva *smooth bezier* dengan gradient fill di bawah kurva, grid horizontal tegangan/daya dinamis, dan tooltip interaktif.

---

## 3. UI State Management

Setiap halaman dan komponen kartu mendukung 6 status UI standar:

1. **Connected (Normal)**:
   - Badge status: Hijau menyala `● ONLINE` dengan denyut glow.
   - Angka telemetri terbarui setiap batch masuk.
2. **Reconnecting**:
   - Badge status: Kuning berkedip `◐ RECONNECTING`.
   - Menampilkan informasi upaya penyambungan ulang.
3. **Disconnected / Offline**:
   - Badge status: Merah `○ OFFLINE`.
   - Menampilkan cap waktu `Terakhir dilihat: 5 menit lalu`.
4. **Sensor Error State**:
   - Kartu metrik menampilkan badge `SENSOR UNREACHABLE` bila sensor mengembalikan status error.
5. **Loading State**:
   - Efek skeleton shimmering pada kartu metrik saat pertama kali membuka halaman.
6. **Empty State**:
   - Menampilkan ilustrasi dan teks instruktif *"Belum ada rekaman riwayat untuk tanggal ini"* pada tabel riwayat.
