# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Teknisi listrik, praktisi IoT, mahasiswa teknik, dan pengguna rumahan yang membutuhkan pemantauan konsumsi listrik AC secara real-time dan audit energi mandiri.

## Product Purpose
Sistem pemantauan konsumsi daya dan parameter kelistrikan AC satu fasa mandiri (*standalone IoT energy monitor*). Alat ini menyajikan data telemetri real-time dan riwayat konsumsi listrik langsung ke perangkat pengguna (smartphone, laptop, tablet) melalui antarmuka web lokal LittleFS yang di-host langsung oleh ESP32 tanpa ketergantungan cloud pihak ketiga.

## Positioning
Sistem monitoring energi AC lokal penuh (*local-first / edge-hosted*): data telemetri streaming langsung via WebSocket dari ESP32 ke browser, dengan penyimpanan riwayat lokal di IndexedDB klien dan ekspor CSV, tanpa risiko keausan flash memory mikrokontroler dan tanpa ketergantungan koneksi internet publik.

## Operating Context
- Perangkat keras terpasang di panel distribusi listrik atau boks MCB pengujian.
- Mikrokontroler ESP32 terhubung ke sensor PZEM-004T v3.0 via port serial UART2 (GPIO16/17, 9600 baud).
- Akses pengguna melalui peramban web modern di jaringan lokal (WiFi Hotspot ESP32 / LAN) via `http://<IP-ESP32>/`.
- Penggunaan harian mencakup pemantauan tegangan, deteksi arus bocor/overload, evaluasi faktor daya ($\cos\phi$), dan unduh CSV untuk pencatatan bulanan.

## Capabilities and Constraints
- **Kemampuan**:
  - Pengukuran akurat Tegangan ($V$), Arus ($A$), Daya Aktif ($W$), Energi Kumulatif ($kWh$), Frekuensi ($Hz$), dan Faktor Daya ($PF$).
  - WebSocket streaming berkala tiap 1000 ms.
  - Logging riwayat telemetri di IndexedDB peramban dan unduh berkas CSV.
- **Batasan**:
  - LittleFS pada ESP32 hanya memuat aset statis (HTML/CSS/JS) untuk mencegah keausan chip flash (*flash wear prevention*).
  - Isolasi galvanik wajib antara sisi tegangan tinggi AC (220V) dan pin mikrokontroler (DC 3.3V/5V).
  - Pembacaan sensor bernilai `NaN` ditangani dengan status sensor error tanpa memancarkan data palsu.

## Brand Commitments
- Antarmuka dashboard bergaya gelap (*dark mode*) modern dengan aksen warna semantik spesifik tiap metrik kelistrikan (Volt = Biru, Ampere = Hijau, Daya = Ungu, PF = Kuning).

## Evidence on Hand
- Berkas firmware aktif: `kwh_meter/kwh_meter.ino`
- Berkas web LittleFS: `kwh_meter/data/index.html`, `real-time.html`, `riwayat.html`, `energy.html`, `pengaturan.html`, `tentang.html`, `style.css`, `script.js`.
- Dokumentasi hardware: `README.txt`.

## Product Principles
1. **Safety First**: Isolasi kelistrikan mutlak; jangan menghubungkan tegangan AC langsung ke ESP32.
2. **Flash Longevity**: LittleFS tidak boleh dipakai untuk logging data berkala; gunakan IndexedDB di peramban klien.
3. **Truth in Telemetry**: Jangan pernah membuat data telemetri tiruan (*dummy*); laporkan kegagalan pembacaan secara jujur bila sensor `NaN`.
4. **Local Autonomy**: Sistem berfungsi 100% tanpa internet luar atau cloud berbayar.

## Accessibility & Inclusion
- Angka pengukuran telemetri wajib menggunakan angka tabular (*tabular numerals*) untuk stabilitas pembacaan saat nilai berubah cepat.
- Kontras warna teks tinggi terhadap latar belakang gelap (standar WCAG AA).
- Tampilan responsif adaptif untuk layar smartphone teknisi di lapangan dan monitor komputer lab.
