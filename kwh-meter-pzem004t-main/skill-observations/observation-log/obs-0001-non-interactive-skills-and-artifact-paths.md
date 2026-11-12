---
id: obs-0001
timestamp: 2026-11-03T20:06:30+07:00
category: execution-friction
skill: task-observer
status: resolved
---

# Observasi Eksekusi: CLI Non-Interaktif dan Jalur Direktori Brain Artifact

## Konteks & Kendala
1. Saat menginstal skill menggunakan perintah `npx skills ...`, perintah memicu konfirmasi interaktif `Ok to proceed? (y)` yang menyebabkan proses background menunggu input tanpa henti (hang).
2. Ketika membuat dokumen task planning menggunakan parameter metadata artifact (`ArtifactMetadata`), penulisan ke path di luar `<appDataDir>/brain/<conversation-id>/` ditolak oleh sistem Antigravity.
3. Pada pengujian delta energy `lib/analytics.js`, urutan evaluasi kondisi reset meter mendahului kondisi rollover 9999.999 kWh.

## Solusi & Pola Sukses
1. Gunakan flag `--yes` dan `-y` pada pemanggilan `npx --yes skills ... -y` agar berjalan tanpa prompt interaktif.
2. File artifact wajib dituliskan secara tepat ke direktori brain `<appDataDir>/brain/<conversation-id>/`.
3. Logika evaluasi rollover wajib ditempatkan sebelum evaluasi reset meter generik agar transisi nilai tinggi (> 9900) ke nilai rendah (< 100) tidak disalahartikan sebagai manual reset.
