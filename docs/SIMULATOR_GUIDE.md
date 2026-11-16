# Mock ESP32 Simulator User Guide: `kwh_meter_pzem004t`

Panduan lengkap penggunaan **Mock ESP32 Simulator** untuk pengujian dan pengembangan tanpa memerlukan perangkat keras fisik.

---

## 1. Ikhtisar Simulator

Simulator ini ditulis dalam **Node.js** murni dan beroperasi sebagai replika virtual dari ESP32 WROOM-32D + PZEM-004T v3.0:
- **Kontrak API 100% Identik**: Mengirim batch JSON dengan header `Authorization: Bearer <TOKEN>` dan `x-device-id` yang persis sama dengan firmware fisik.
- **Model Fisika Nyata**: Menghitung tegangan, arus, faktor daya, daya aktif ($P = V \times I \times PF$), dan energi kumulatif ($\Delta E = \frac{P \times \Delta t}{3.600.000}$).
- **Mode Kegagalan Lengkap**: Menguji ketahanan backend dan dashboard terhadap pemadaman jaringan, beban tinggi, dan error sensor.

---

## 2. Cara Menjalankan

### 2.1 Mode Interaktif (CLI Shell)
```bash
npm run simulator
```

Output antarmuka terminal:
```text
======================================================
🚀 ESP32 MOCK SIMULATOR STARTED
📡 Target API     : http://localhost:3000/api/telemetry
🆔 Device ID      : kwh-meter-001
⚡ Simulation Mode: [normal] (Normal Load)
⏱  Sampling / Push : 1000ms / 5000ms
======================================================

Ketik "help" untuk melihat daftar perintah simulator.

SIMULATOR> 
```

### 2.2 Mode Otomatis / Headless
```bash
# Menjalankan di background dengan mode tertentu
node simulator/index.js --headless --mode=normal
```

---

## 3. Daftar Perintah CLI

| Perintah | Deskripsi | Efek pada Data |
| :--- | :--- | :--- |
| `mode normal` | Mengaktifkan beban rumah tangga normal (~380 Watt, 1.8A, PF 0.95). | Data mengalir normal setiap 5 detik. |
| `mode high-load` | Mensimulasikan lonjakan beban tinggi (~1850 Watt, 8.5A, AC/setrika/oven). | Daya dan arus naik drastis; laju kWh meningkat cepat. |
| `mode idle` | Mensimulasikan mode siaga malam hari (~50 Watt, 0.25A, lampu LED/router). | Konsumsi energi sangat lambat. |
| `mode offline` | Mensimulasikan Wi-Fi putus. Data ditampung di antrean offline lokal. | Dashboard berubah menjadi Offline. |
| `mode sensor-error` | Menyuntikkan `NaN`, nilai negatif, dan data rusak. | Memverifikasi backend mengembalikan HTTP 400. |
| `mode network-failure` | Mensimulasikan kegagalan jaringan HTTP (timeout / 500). | Simulator menahan batch dan melakukan retry. |
| `accelerate 30` | **Akselerasi Waktu 30 Hari**: Menghasilkan data 1 bulan dalam hitungan detik. | Mengisi ringkasan bulanan dan grafik tahunan seketika! |
| `reset-energy` | Me-reset register kumulatif kWh ke 0. | Menguji ketahanan kalkulasi delta tanpa nilai minus. |
| `status` | Menampilkan metrik simulator, buffer RAM, dan status koneksi. | Laporan diagnostik instan. |
| `exit` | Menghentikan simulator dan keluar dari terminal. | Clean teardown. |

---

## 4. Contoh Skenario Pengujian

### Skenario A: Pengujian Pemadaman Listrik & Pemulihan Jaringan (Offline Queue)
1. Jalankan `npm run simulator`.
2. Ketik `mode offline`. Perhatikan bahwa simulator berhenti mengirim HTTP dan mulai menampung data di `offlineQueue`.
3. Biarkan selama 30 detik (menghasilkan ~30 records).
4. Ketik `mode normal`. Simulator otomatis tersambung kembali dan menampilkan:  
   `🔄 Reconnected to network. Draining 30 queued records...`
5. Seluruh data yang sempat tertahan dikirimkan ke cloud tanpa ada satu data pun yang hilang (*zero data loss*).

### Skenario B: Pengujian Tagihan Listrik Bulanan dalam 10 Detik
1. Di CLI simulator, ketik:
   ```text
   accelerate 30
   ```
2. Simulator akan memproses 30 hari data dengan kurva beban realistis (pagi sibuk, siang normal, malam puncak, dini hari siaga).
3. Buka browser di `http://localhost:3000/riwayat.html` atau periksa `/api/summary`: Anda akan langsung melihat konsumsi bulanan (misal: ~80-120 kWh) dan estimasi biaya listrik dalam Rupiah!
