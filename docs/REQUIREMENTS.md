# System Requirements & Architecture Decisions: `kwh_meter_pzem004t`

Dokumen ini mencatat requirement final, keputusan arsitektur hasil sesi *Grill Me*, dan batasan implementasi sistem.

---

## 1. Status Baseline Requirements

- **Target Hardware**: ESP32 WROOM-32D DevKit + PZEM-004T v3.0 TTL.
- **Komunikasi Sensor**: UART2 (GPIO16 RX2, GPIO17 TX2), 9600 baud, 8N1.
- **Arsitektur Jaringan Target**: ESP32 / Simulator -> HTTPS Batch -> Vercel Serverless API -> Firebase Realtime Database -> Web Dashboard (Firebase Listener).
- **Simulator**: Wajib mandiri, mematuhi kontrak API yang sama dengan hardware fisik, dengan simulasi fisika kelistrikan akurat ($P = V \times I \times PF$, $\Delta E = \frac{P \times \Delta t}{3600000}$).
- **Target Deployment**: Vercel (untuk Serverless API & Dashboard) dan Firebase Realtime Database. Simulator dan ESP32 harus match 100% terhadap kontrak Vercel API.

---

## 2. Keputusan Sesi Klarifikasi (Grill Me Round 1) — Confirmed

| No | Topik Keputusan | Status | Keputusan Disetujui | Konsekuensi & Rincian Teknis |
| :--- | :--- | :--- | :--- | :--- |
| **Q1** | **Sampling & Upload Batching** | **ACCEPTED (A)** | Sensor/Simulator sampling setiap 1 detik. Upload via HTTPS batch setiap 5 detik (berisi 5 records per payload). | Memenuhi kuota gratis Vercel Serverless (maks 100k invocations/bulan); hemat bandwidth; latensi update dashboard 5 detik per batch, tetap responsif. |
| **Q2** | **Retensi & Agregasi Data** | **ACCEPTED (A)** | 30 Hari Raw Records di `history/` + Agregasi permanen per jam, hari, dan bulan di `summaries/`. | Melindungi kuota gratis Firebase RTDB (1 GB storage); query performa tinggi untuk grafik tahunan tanpa beban memori. |
| **Q3** | **Aksesibilitas & Auth** | **ACCEPTED (A)** | Dashboard Monitoring Publik (Read-Only) + Menu Pengaturan Wajib Login Admin (Firebase Auth). | Teknisi/pengguna dapat memantau live dari ponsel tanpa login; aksi kritis (tarif, alarm overload, reset kWh) terkunci aman. |
| **Q4** | **Offline Queue ESP32** | **ACCEPTED (A)** | RAM Ring-Buffer (~1.000 records / ~15-20 menit) + Fallback LittleFS bila internet padam lama. | Menghilangkan keausan chip flash LittleFS saat operasi normal; menjamin zero data loss saat pemadaman Wi-Fi panjang; deduplikasi via `batchId`. |
| **Q5** | **Simulator & API Contract** | **ACCEPTED (A)** | Node.js CLI Simulator berbasis perhitungan fisika nyata; mendukung semua failure modes & 30d time acceleration; 100% match kontrak Vercel API. | Pengujian end-to-end tanpa hardware fisik; validasi perhitungan delta energi dan tagihan listrik bulanan dalam hitungan menit. |
