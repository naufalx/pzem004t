# Domain Documentation Guidelines

This document outlines how engineering skills interact with the domain model and architectural decisions of `kwh_meter_pzem004t`.

## Layout

This project follows a **single-context** architecture:

```
/
├── GLOSSARY.md        # Ubiquitous domain language (hardware & firmware concepts)
├── docs/adr/          # Architecture Decision Records
│   └── 0001-*.md
├── PRODUCT.md         # Product positioning & goals (Impeccable)
├── DESIGN.md          # UI & Design System standards (Impeccable)
├── kwh_meter/         # Firmware (.ino) and LittleFS Web UI (data/)
└── .agents/skills/    # Installed workspace skills
```

## Rules for Agents

1. **Read Domain Context First**: Before modifying firmware or web UI, consult `GLOSSARY.md` and relevant files in `docs/adr/`.
2. **Respect Glossary Terms**: Use exact terms (e.g., `activePower`, `powerFactor`, `PZEM-004T v3.0`, `LittleFS`, `IndexedDB`). Do not invent conflicting synonyms.
3. **Log Architecture Decisions**: Significant changes (e.g., communication protocol, pin assignments, storage strategy) must be documented as an ADR in `docs/adr/`.
