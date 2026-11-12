# ADR 0001: Penanganan Kegagalan Sensor dan Pemulihan Koneksi WebSocket

## Status
Accepted

## Konteks
Pada sistem kWh meter berbasis ESP32 dan modul PZEM-004T v3.0:
1. Pembacaan UART ke sensor PZEM dapat mengalami timeout atau data rusak (misalnya saat tegangan AC drop, konektor kendor, atau gangguan elektromagnetik beban induktif tinggi). Fungsi `pzem.voltage()`, `pzem.current()`, dsb., akan mengembalikan nilai `NAN` (`isnan() == true`).
2. Klien browser terhubung via WebSocket port 81. Bila ESP32 mengalami restart, WiFi terputus, atau browser berpindah tab/jaringan, WebSocket bisa terputus.
3. Flash memory ESP32 memiliki batasan siklus hapus/tulis (*flash wear* ~10,000–100,000 siklus). Menyimpan log riwayat per detik ke LittleFS akan merusak chip flash dalam waktu singkat.

## Keputusan
1. **Pemisahan Penyimpanan Riwayat**:
   - LittleFS HANYA digunakan untuk aset web statis (HTML, CSS, JS). LittleFS berstatus *read-only* saat runtime operasional.
   - Seluruh riwayat data telemetri disimpan di sisi klien (*client-side*) menggunakan **IndexedDB** di peramban (browser).
2. **Validasi Telemetri (Anti-Data Palsu)**:
   - ESP32 memvalidasi nilai dengan `!isnan(...)` sebelum membungkus payload JSON.
   - Bila sensor mengembalikan `NAN`, firmware mempertahankan nilai valid terakhir atau menandai status payload `"status": "sensor_error"`. Nilai acak atau data tiruan dilarang dipancarkan.
3. **Penyambungan Ulang Otomatis (*Auto-Reconnect*) WebSocket**:
   - `script.js` pada browser mengimplementasikan mekanisme *exponential backoff / reconnect loop* (interval 2-5 detik) bila *event* `onclose` atau `onerror` terjadi pada WebSocket.
4. **Proteksi Reset Energi**:
   - Reset kWh hanya dikirim jika ada konfirmasi eksplisit dari pengguna di halaman pengaturan, yang memanggil `pzem.resetEnergy()`.

## Konsekuensi
- **Positif**:
  - Flash memory ESP32 terlindungi dari aus (*wear-leveling safe*).
  - Web UI tidak menampilkan grafik lonjakan palsu akibat pembacaan korup.
  - Klien web dapat pulih secara otomatis tanpa perlu merefresh halaman manual saat sinyal WiFi ESP32 sempat terputus.
- **Batasan**:
  - Riwayat IndexedDB tersimpan di browser klien; data tidak terekam jika browser dalam keadaan tertutup.
