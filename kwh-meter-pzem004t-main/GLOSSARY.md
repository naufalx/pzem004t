# GLOSSARY: kWh Meter IoT (ESP32 + PZEM-004T)

Kamus istilah domain untuk perangkat keras, firmware, dan antarmuka web proyek kWh Meter.

---

### Hardware & Electronics

- **ESP32**: Mikrokontroler 32-bit dual-core dengan konektivitas Wi-Fi dan Bluetooth bawaan, bertindak sebagai web server, WebSocket server, dan pengolah komunikasi serial sensor.
- **PZEM-004T v3.0**: Modul sensor multifungsi pengukur daya AC (Tegangan, Arus, Daya Aktif, Energi Kumulatif, Frekuensi, dan Faktor Daya) yang berkomunikasi via TTL UART (Modbus-RTU).
- **CT (Current Transformer)**: Trafo arus eksternal (tipe solid core atau split core) yang dipasang melingkari kabel fasa AC untuk mengukur arus induksi secara terisolasi.
- **UART2 (Hardware Serial 2)**: Port serial perangkat keras ESP32 yang dialokasikan khusus untuk PZEM-004T:
  - RX2 = GPIO 16 (terhubung ke TX PZEM)
  - TX2 = GPIO 17 (terhubung ke RX PZEM)
  - Baud rate: 9600 bps.

---

### Measurement Metrics & Telemetry

- **Voltage ($V$)**: Tegangan efektif bolak-balik (RMS) dalam satuan Volt ($V$).
- **Current ($I$)**: Arus bolak-balik (RMS) dalam satuan Ampere ($A$).
- **Active Power ($P$)**: Daya nyata / aktif yang diserap beban dalam satuan Watt ($W$). Nilai pembacaan sensor tidak dihitung ulang manual oleh ESP32.
- **Energy ($E$)**: Energi listrik aktif kumulatif yang terakumulasi di register internal PZEM dalam satuan kiloWatt-jam ($kWh$). Reset energi dilakukan melalui instruksi register hardware PZEM, bukan manipulasi database web.
- **Frequency ($f$)**: Frekuensi tegangan listrik AC dalam satuan Hertz ($Hz$), standar grid Indonesia 50 Hz.
- **Power Factor ($PF$)**: Faktor daya ($\cos \phi$), rasio antara daya aktif ($W$) dengan daya semu ($VA$), rentang 0.00 hingga 1.00.

---

### Software & Architecture

- **LittleFS**: Sistem berkas *flash memory* ringan pada ESP32 yang menyimpan berkas aset web statis (`index.html`, `style.css`, `script.js`, dll.).
- **WebSocket (Port 81)**: Protokol komunikasi dua arah *full-duplex* berlatensi rendah antara ESP32 (`WebSocketsServer`) dan browser web untuk *streaming* telemetri real-time tiap 1000 ms.
- **IndexedDB**: Basis data NoSQL lokal di dalam browser web klien untuk menyimpan riwayat pembacaan secara persisten tanpa membebani flash memory ESP32.
- **CSV Export**: Fitur pembuatan dan pengunduhan berkas *Comma-Separated Values* langsung dari IndexedDB browser.
- **NaN Handling**: Penanganan kegagalan baca register sensor; jika sensor merespons NaN (karena kabel putus atau noise AC), nilai palsu (dummy) tidak boleh dipancarkan ke dashboard.
