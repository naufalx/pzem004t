# System Architecture: `kwh_meter_pzem004t`

Dokumen ini mendefinisikan arsitektur sistem menyeluruh, interaksi antarkomponen, dan kontrak pipeline data.

---

## 1. Diagram Arsitektur Menyeluruh

```mermaid
flowchart TD
    subgraph HARDWARE_PRODUCER["1. Perangkat Keras Nyata (Real Device)"]
        AC_LINE["Tegangan AC 220V + Beban"]
        CT["Current Transformer (CT)"]
        PZEM["Modul Sensor PZEM-004T v3.0"]
        ESP32["ESP32 WROOM-32D DevKit"]

        AC_LINE --> PZEM
        CT --> PZEM
        PZEM <==>|UART2 9600 8N1<br/>RX2 GPIO16 / TX2 GPIO17| ESP32
        
        subgraph ESP_MODULES["Firmware Modular C++"]
            PZEM_MGR["PZEM Manager<br/>(1s Read, NaN Validator)"]
            TIME_MGR["Time Manager<br/>(NTP Sync, UTC Epoch)"]
            RAM_QUEUE["Data Queue<br/>(RAM Ring Buffer 1000 items)"]
            FLASH_QUEUE["Emergency Spillover<br/>(LittleFS Binary Buffer)"]
            HTTPS_CLIENT["Telemetry Client<br/>(HTTPS WiFiClientSecure)"]

            PZEM_MGR --> RAM_QUEUE
            TIME_MGR -.->|Inject Timestamp| PZEM_MGR
            RAM_QUEUE -.->|Overflow (>1000)| FLASH_QUEUE
            RAM_QUEUE -->|5s Batch (5 items)| HTTPS_CLIENT
            FLASH_QUEUE -->|Drain on Reconnect| HTTPS_CLIENT
        end
    end

    subgraph SIMULATOR_PRODUCER["2. Simulator Perangkat (Mock ESP32 Simulator)"]
        SIM_CORE["Node.js CLI Simulator (npm run simulator)"]
        PHYSICS["Physics Engine<br/>P = V * I * PF<br/>dE = P*dt / 3600000"]
        FAILURE_MODES["Mode Controller<br/>normal / high-load / idle<br/>offline / sensor-error / network-failure"]
        SIM_HTTP["HTTPS Client (Axios / Native Fetch)<br/>Identical Payload Contract & Token"]

        FAILURE_MODES --> PHYSICS
        PHYSICS --> SIM_CORE
        SIM_CORE --> SIM_HTTP
    end

    subgraph INGESTION_BACKEND["3. Serverless API Ingestion (Vercel)"]
        V_AUTH["Auth Guard<br/>Validate x-device-token & deviceId"]
        V_SANITY["Sanitizer & Bounds Checker<br/>Reject NaN, Inf, Negative, Extreme"]
        V_DEDUP["Deduplication Engine<br/>Check batchId & sequence order"]
        V_AGG["Delta Energy & Summaries Aggregator<br/>Update Today, Month, Year & Peak"]
        V_FB_ADMIN["Firebase Admin SDK<br/>Privileged Fast Multi-path Write"]

        V_AUTH --> V_SANITY
        V_SANITY --> V_DEDUP
        V_DEDUP --> V_AGG
        V_AGG --> V_FB_ADMIN
    end

    subgraph REALTIME_STORAGE["4. Realtime Database (Firebase RTDB)"]
        DB_LATEST["devices/{deviceId}/latest<br/>(Snapshot data terkini)"]
        DB_STATUS["devices/{deviceId}/status<br/>(Online, IP, FW Version, Last Seen)"]
        DB_HIST["history/{deviceId}/{YYYY-MM-DD}/{recordId}<br/>(Retensi detail 30 hari)"]
        DB_SUMM["summaries/{deviceId}/daily/ & monthly/<br/>(Agregasi delta kWh & biaya permanen)"]
    end

    subgraph WEB_DASHBOARD["5. Web Client (Vercel Hosted Frontend)"]
        DASH_UI["Dashboard Real-time<br/>(Firebase SDK onValue Listener)"]
        DYNAMIC_CHART["Dynamic Telemetry Charts<br/>(Smooth Canvas / SVG Renderer)"]
        ANALYTICS_VIEW["Energy Analytics View<br/>(Daily/Monthly Bar Charts, Cost Calc)"]
        HIST_TABLE["History Explorer & CSV Exporter<br/>(Filtered Date Range Queries)"]
        SETTINGS_ADMIN["Admin Settings<br/>(Protected by Firebase Auth)"]
    end

    HTTPS_CLIENT ==>|POST /api/telemetry (Batch 5s)| V_AUTH
    SIM_HTTP ==>|POST /api/telemetry (Batch 5s)| V_AUTH

    V_FB_ADMIN -->|Update Latest| DB_LATEST
    V_FB_ADMIN -->|Heartbeat| DB_STATUS
    V_FB_ADMIN -->|Append History| DB_HIST
    V_FB_ADMIN -->|Update Summaries| DB_SUMM

    DB_LATEST <==|Event-Driven onValue Listener (Zero Polling)| DASH_UI
    DB_STATUS <==|onValue Listener| DASH_UI
    DASH_UI --> DYNAMIC_CHART
    DB_SUMM -.->|Read Agregat| ANALYTICS_VIEW
    DB_HIST -.->|Query Terfilter| HIST_TABLE
    SETTINGS_ADMIN -.->|Protected Write API| V_AUTH
```

---

## 2. Prinsip Rekayasa Sistem

1. **Keselarasan Mutlak Kontrak (Contract Parity)**: Simulator Mock ESP32 dan ESP32 fisik memancarkan payload JSON dengan schema yang 100% sama. Backend Vercel tidak memiliki percabangan kode khusus (*no mock branch*).
2. **Event-Driven Push (Tanpa Polling)**: Dashboard web tidak memanggil `fetch()` berulang setiap detik. Frontend berlangganan langsung ke node Firebase RTDB via `onValue()`.
3. **Ketahanan Offline & Proteksi Flash**: Jika koneksi internet terputus, ESP32 menahan data di RAM. LittleFS hanya digunakan sebagai wadah darurat jika pemadaman melebihi batas RAM.
4. **Validasi Batas Fisik Numerik (Sanitization)**: Backend menolak nilai $V, I, P, PF, f$ yang berada di luar batas fisik sensor PZEM-004T.
5. **Pemisahan Logika Data**:
   - `latest/` untuk update instan (< 100ms ke browser).
   - `history/` untuk audit log 30 hari.
   - `summaries/` untuk laporan bulanan dan grafik tahunan permanen.
