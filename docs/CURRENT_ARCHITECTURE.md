# Current Architecture: `kwh_meter_pzem004t`

Dokumen ini mendokumentasikan arsitektur faktual dari basis kode saat ini sebelum transformasi cloud.

---

## 1. Diagram Arsitektur Saat Ini

```mermaid
flowchart TD
    subgraph HARDWARE["Hardware Layer"]
        AC["Grid Listrik AC 220V"]
        PZEM["PZEM-004T v3.0 Modul"]
        ESP["ESP32 WROOM-32D"]
        AC -.->|Induksi CT & Tegangan| PZEM
        PZEM <-->|UART2 9600 bps<br/>GPIO16 RX / GPIO17 TX| ESP
    end

    subgraph ESP_FIRMWARE["ESP32 Firmware Monolithic (kwh_meter.ino)"]
        FW_ACQ["Loop Akuisisi Sensor (Setiap 1000ms)"]
        FW_JSON["ArduinoJson Document Serializer"]
        FW_HTTP["WebServer Port 80 (LittleFS File Serving)"]
        FW_WS["WebSocketsServer Port 81 (Broadcast TXT)"]
        
        FW_ACQ --> FW_JSON
        FW_JSON --> FW_WS
        FW_HTTP -.->|Menyajikan HTML/CSS/JS| BROWSER
    end

    subgraph CLIENT["Client Browser (Hanya saat dibuka)"]
        BROWSER["Peramban Web (Laptop/Ponsel)"]
        WS_CLIENT["WebSocket Client (Port 81)"]
        IDB["IndexedDB (KWHMeterDB/riwayat)"]
        DOM["DOM Dashboard Updates"]
        CSV["CSV Generator Export"]

        WS_CLIENT --> DOM
        WS_CLIENT --> IDB
        IDB --> CSV
    end

    ESP --> FW_ACQ
    FW_WS <==>|WebSocket Stream (ws://IP-ESP32:81/)| WS_CLIENT
```

---

## 2. Karakteristik Komponen Aktual

### 2.1 Perangkat Keras & Serial
- **Sensor**: PZEM-004T v3.0 TTL.
- **Port Serial**: HardwareSerial `Serial2` pada ESP32.
- **Pin**:
  - `PZEM_RX_PIN = 16` (ESP32 RX2 terhubung ke PZEM TX)
  - `PZEM_TX_PIN = 17` (ESP32 TX2 terhubung ke PZEM RX)
- **Baud Rate**: 9600 bps, format 8N1.
- **Frekuensi Sampling**: Setiap 1000 ms (`SEND_INTERVAL = 1000`).

### 2.2 Komunikasi & Jaringan
- **Mode Wi-Fi**: `WIFI_STA` (Station).
- **Protokol Web**: HTTP biasa pada Port 80, tanpa HTTPS / TLS.
- **Protokol Telemetri**: WebSocket broadcast unencrypted pada Port 81.
- **Payload Format**: JSON string satu paket data per detik:
  ```json
  {
    "voltage": 220.5,
    "current": 1.25,
    "powerFactor": 0.95,
    "activePower": 250.0,
    "energy": 12.45,
    "frequency": 50.0
  }
  ```

### 2.3 Penyimpanan Data
- **ESP32 LittleFS**: Menyimpan file statis frontend:
  - `index.html`
  - `real-time.html`
  - `riwayat.html`
  - `energy.html`
  - `pengaturan.html`
  - `tentang.html`
  - `style.css`
  - `script.js`
- **Client IndexedDB**:
  - Database: `KWHMeterDB`
  - Object Store: `riwayat` (key: `id` auto-increment, index: `waktu`)
  - Logika penyimpanan: Setiap menerima event `socket.onmessage`, fungsi `simpanRiwayat()` menulis 1 baris ke IndexedDB.

---

## 3. Titik Lemah Arsitektur Saat Ini

1. **Jangkauan Terbatas (LAN Only)**: Dashboard hanya dapat diakses oleh perangkat yang berada di dalam satu jaringan Wi-Fi lokal yang sama dengan ESP32.
2. **Ketiadaan Data Historis yang Otonom**: Jika browser ditutup atau laptop dimatikan, data telemetri yang dipancarkan ESP32 hilang tanpa jejak.
3. **Beban Mikrokontroler**: Mikrokontroler memikul beban serving static assets, parsing HTTP, mengelola socket state, dan akuisisi sensor secara bersamaan pada core yang sama.
4. **Grafik Tidak Realistis**: Grafik dashboard menggunakan poligon SVG statis tanpa integrasi data asli.
5. **Ketiadaan Pengamanan**: Tidak ada autentikasi perangkat, tidak ada enkripsi TLS, dan SSID/Password terpasang statis di firmware.
