# Skill Observations

Repositori ini menggunakan `task-observer` untuk menangkap observasi, friksi pengerjaan, dan peluang peningkatan kemampuan agen selama pengembangan proyek.

## Struktur Direktori
- `observation-log/`: Catatan observasi aktif (satu file per observasi berformat Markdown dengan YAML frontmatter).
- `observation-log/archive/`: Catatan observasi yang telah diselesaikan atau diintegrasikan melalui *weekly review*.

## Alur Kerja
1. Saat terjadi kendala (misal: timeout serial PZEM, error kompilasi ArduinoJson, atau bug responsive CSS), `task-observer` mencatat kasus tersebut ke `observation-log/`.
2. Dalam sesi review, catatan diubah menjadi perbaikan aturan pada `AGENTS.md` atau pembuatan modul skill baru di `.agents/skills/`.
