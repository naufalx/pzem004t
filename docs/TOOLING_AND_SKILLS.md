# Tooling, Skills, & Environment Capability Audit: `kwh_meter_pzem004t`

Laporan pemetaan kapabilitas lingkungan pengembang lokal, ketersediaan tools, AI agent skills, dan dependensi proyek.

---

## 1. Tools & Runtimes yang Tersedia di Environment

| Tool / Runtime | Lokasi Binary | Versi Faktual | Status & Peran dalam Proyek |
| :--- | :--- | :--- | :--- |
| **Node.js** | `/home/linuxmint/.nvm/versions/node/v27.0.0-alpha.0.0.0/bin/node` | `v27.0.0-alpha` | **Tersedia**. Runtime utama Backend Vercel API, Mock Simulator, dan Automated Testing. |
| **npm** | `/home/linuxmint/.nvm/versions/node/v27.0.0-alpha.0.0.0/bin/npm` | `12.1.0` | **Tersedia**. Package manager JavaScript/TypeScript. |
| **Bun** | `/home/linuxmint/.bun/bin/bun` | `1.3.x` | **Tersedia**. Runtime alternatif berkecepatan tinggi untuk eksekusi script dan test runner. |
| **Python 3** | `/usr/bin/python3` | `3.12.3` | **Tersedia**. Ekosistem scripting dan host runner untuk PlatformIO Core. |
| **pip** | `/usr/bin/pip` | `24.0` | **Tersedia**. Python package installer. |
| **Git** | `/usr/bin/git` | `2.43.0` | **Tersedia**. Version control sistem lokal. |
| **cURL** | `/usr/bin/curl` | `8.5.0` | **Tersedia**. HTTP testing client. |

---

## 2. Tools yang Belum Tersedia & Rekomendasi Pemasangan

| Tool yang Dibutuhkan | Status Saat Ini | Alasan Kebutuhan | Rekomendasi Aksi & Alternatif |
| :--- | :--- | :--- | :--- |
| **PlatformIO Core (`pio`)** | Belum terpasang di PATH | Diperlukan untuk kompilasi lokal firmware ESP32, manajemen library C++, dan static code analysis. | **Rekomendasi**: Pasang via virtual environment Python (`python3 -m venv .venv && .venv/bin/pip install platformio`) agar tidak mencemari sistem global. <br>**Alternatif**: Gunakan `arduino-cli` portable atau verifikasi sintaks statis C++ via g++/clang jika kompilasi hardware fisik ditunda. |
| **GitHub CLI (`gh`)** | Belum terpasang | Membantu manajemen issue dan PR GitHub langsung dari terminal. | **Alternatif Terpilih**: Menggunakan konvensi **Local Markdown Issue Tracker** di `.scratch/<feature>/` yang sudah diuji 100% stabil tanpa dependensi `gh`. |
| **Firebase CLI (`firebase-tools`)** | Belum terpasang global | Diperlukan untuk deployment Firebase Security Rules dan Database Indexes. | **Rekomendasi**: Jalankan secara on-demand via `npx firebase-tools` tanpa perlu instalasi global permanen. |

---

## 3. Kapabilitas Agent Skills yang Terpasang di Workspace (`.agents/skills/`)

Repositori ini telah dilengkapi dengan 14 modul skill aktif yang siap dieksekusi:

1. **`using-superpowers`**: Penegakan disiplin agen dan meta-governance sebelum eksekusi.
2. **`grilling` / `grill-me`**: Wawancara Sokrates putaran terstruktur untuk menguji asumsi teknis arsitektur.
3. **`find-skills`**: Pencarian dan instalasi paket skill baru dari ekosistem open-agent skills.
4. **`setup-matt-pocock-skills`**: Standardisasi tata kelola repositori rekayasa software.
5. **`mem-search`**: Mesin memori persisten lintas-sesi Claude-Mem.
6. **`impeccable`**: Standar craftmanship antarmuka web, audit UX/UI, dan sistem desain.
7. **`task-observer`**: Pengamat friksi dan pembelajaran mandiri berkelanjutan.
8. **`brainstorming` & `writing-plans`**: Perancangan solusi kreatif dan dokumen implementasi teruji.
9. **`executing-plans` & `systematic-debugging`**: Eksekusi rencana bertahap dan pelacakan akar masalah.
10. **`test-driven-development` & `verification-before-completion`**: Verifikasi bukti konkret sebelum klaim selesai.

---

## 4. Dependensi yang Dibutuhkan Proyek

### 4.1 Backend & Simulator (Node.js/npm)
- `firebase-admin`: Ingestion backend & privileged updates ke Firebase Realtime Database.
- `firebase`: Client Web SDK v10 (modular) untuk frontend listener `onValue`.
- `dotenv`: Pengelolaan environment variables (`.env`).
- `jest` atau `vitest`: Automated testing suite untuk backend validation, simulator physics, dan data integrity.

### 4.2 Firmware ESP32
- Framework: `arduino`
- Board: `esp32dev` (ESP32 WROOM-32D DevKit)
- Library:
  - `mandulaj/PZEM-004T-v30`: Library komunikasi register sensor PZEM.
  - `bblanchon/ArduinoJson`: Serializer & deserializer payload batch (v7).
  - `WiFiClientSecure`: Komunikasi TLS/HTTPS ke Vercel API.
