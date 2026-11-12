# AGENTS.md: Petunjuk & Standar Kerja AI Agent

Dokumen ini adalah panduan utama bagi AI Agent yang bekerja pada repositori `kwh_meter_pzem004t`.

---

## 1. Identitas & Gambaran Proyek

Proyek ini adalah sistem **IoT Smart kWh Meter AC Single-Phase** berbasis:
- **Mikrokontroler**: ESP32 WROOM-32D (PlatformIO C++: `firmware/`).
- **Sensor Listrik**: PZEM-004T v3.0 TTL dengan Current Transformer (CT) 100A.
- **Komunikasi Serial Hardware**: UART2 (GPIO16 = RX2, GPIO17 = TX2), Baud rate: 9600 bps.
- **Cloud Ingestion Backend**: Vercel Serverless Functions (`api/telemetry.js`, `api/history.js`, `api/summary.js`, `api/reset.js`, `api/device/status.js`).
- **Cloud Database**: Google Firebase Realtime Database (Region: `asia-southeast1`).
- **Web Dashboard**: Vanilla HTML5, CSS3, ES Modules di dalam folder `public/` dengan streaming realtime Firebase Web SDK (`onValue`).
- **Penyimpanan Riwayat Klien & Ekspor**: Riwayat tersinkronisasi di Firebase RTDB dan dapat diekspor langsung ke CSV terformat rapi untuk Microsoft Excel.

> [!CAUTION]
> **Keselamatan Listrik Tegangan Tinggi AC (220V):**
> Sisi AC PZEM-004T terhubung langsung ke sumber tegangan PLN berbahaya. Sisi mikrokontroler (DC 3.3V/5V) harus terisolasi secara galvanik. Dilarang menghubungkan jalur AC ke pin mana pun pada board ESP32.

---

## 2. Agent Skills

Repositori ini telah dilengkapi dengan ekosistem agent skills di dalam folder `.agents/skills/`:

### Anti-Slop System (`miqdadbadjuber/anti-slop`)
Ekosistem filter anti-AI slop untuk kode, UI, copywriting, dan aksesibilitas:
- **`antislop`**: Filter inti aturan R-01 s.d. R-40, three-tier rules, dan Delivery Gate.
- **`antislop-ui`**: Tata letak, warna, komponen, dekorasi, gerakan, dan performa halaman.
- **`antislop-copywriting`**: Eliminasi buzzword AI, kebersihan markdown, dan larangan em-dash (R-02).
- **`antislop-human`**: Aksesibilitas WCAG 2.2, kontras warna (`contrast-check.py`), fokus keyboard, dan target sentuh 44px.
- **`antislop-layoutmobile`**: Reflow layar responsif tanpa horizontal overflow hingga resolusi 320px.
- **`antislop-code`**: Pembersihan komentar AI dekoratif (`====`, `----`) tanpa mengubah kode fungsional.

### UI/UX Pro Max (`nextlevelbuilder/ui-ux-pro-max-skill`)
Kecerdasan desain UI/UX komprehensif untuk web, mobile, dan dashboard:
- **`ui-ux-pro-max`**: Sistem panduan desain lokal (79 gaya, 192 palet produk, 74 font pairings, 119 pedoman UX). Standar implementasi Vercel Design System dan tipografi resmi Geist / Geist Mono.

### Issue tracker
Pelacakan isu dan tiket kerja disimpan secara lokal dalam format markdown di bawah `.scratch/`. Lihat `docs/agents/issue-tracker.md`.

### Domain docs
Tata kelola dokumen domain menggunakan tata letak *single-context*. Lihat `docs/agents/domain.md`, kamus istilah di `GLOSSARY.md`, dan keputusan arsitektur di `docs/adr/`.

---

## 3. Pemetaan Alat untuk Antigravity CLI (`agy`)

Saat mengeksekusi instruksi dari skill pada Antigravity CLI:
- **Dispatch Subagent**: Gunakan tool `invoke_subagent` (`TypeName: "self"` untuk tugas dengan hak penuh, atau `TypeName: "research"` untuk penelusuran *read-only*).
- **Task Tracking (Todo List)**: Antigravity CLI tidak memiliki tool todo terpisah (`manage_task` hanya untuk mengontrol *background process*). Buat dan kelola **Task Artifact** (checklist Markdown `- [ ]` dan `- [x]`) menggunakan tool `write_file` / `edit_file` di direktori brain artifact.
- **Progressive Disclosure**: Buka file referensi di dalam folder `references/` tiap skill hanya saat pemicunya (*trigger*) terpenuhi.

---

## 4. Disiplin & Alur Kerja Terpadu (Unified Workflow)

1. **Meta-Governance (`using-superpowers`)**:
   - Sebelum memulai respon atau tindakan apa pun, periksa apakah ada skill yang cocok di `.agents/skills/`.
   - Proses mendahului implementasi: brainstorming dan perencanaan sebelum penulisan kode.
2. **Memori Lintas Sesi (`mem-search`)**:
   - Jika membutuhkan referensi pekerjaan atau perbaikan masa lalu, jalankan pencarian memori bertahap: index -> timeline -> detail.
3. **Wawancara Sokrates (`grill-me` / `grilling`)**:
   - Sebelum menyetujui perubahan arsitektur atau penambahan fitur besar, uji semua asumsi melalui putaran tanya-jawab terstruktur. Hasil keputusan dicatat ke `docs/adr/`.
4. **Kualitas Desain & Antarmuka (`impeccable`)**:
   - Setiap perubahan pada berkas `kwh_meter/data/*.html`, `style.css`, dan `script.js` wajib merujuk pada `PRODUCT.md` dan `DESIGN.md`.
   - Gunakan skrip `.agents/skills/impeccable/scripts/impeccable` untuk audit, pemolesan, dan pengujian tata letak.
5. **Disiplin Anti-Slop (`antislop`)**:
   - Seluruh kode, komentar, teks antarmuka, dan gaya CSS wajib lolos Delivery Gate Anti-Slop.
   - Bersihkan komentar banner dekoratif (`====`, `----`) dan larang em-dash (`—`) pada teks biasa sesuai aturan R-02.
   - Pastikan rasio kontras warna dan target sentuh 44px memenuhi standar `antislop-human`.
6. **Observasi Berkelanjutan (`task-observer`)**:
   - Catat setiap kendala eksekusi, pola kegagalan alat, atau koreksi pengguna ke `skill-observations/observation-log/`.
   - Gunakan hasil observasi untuk memutakhirkan `AGENTS.md` dan membuat skill baru melalui `find-skills`.
6. **Verifikasi Sebelum Klaim Selesai (`verification-before-completion`)**:
   - Selalu jalankan uji verifikasi (sintaks kode, konsistensi file, ketersediaan library) dan tunjukkan bukti sebelum menyatakan pekerjaan selesai.
