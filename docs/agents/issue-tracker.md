# Issue Tracker: Local Markdown

Issues, specs, and task breakdowns for `kwh_meter_pzem004t` are tracked locally in `.scratch/`.

## Conventions

- One feature or effort per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation tickets are individual files: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Statuses: `needs-triage`, `needs-info`, `ready-for-agent`, `claimed`, `resolved`, `wontfix`.
- Comments and discussion append under `## Comments`.

## Operations

- **Publish**: Write a new markdown file under `.scratch/<feature-slug>/`.
- **Fetch**: Read `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.
- **Wayfinding**: Use `.scratch/<effort>/map.md` with child tickets in `.scratch/<effort>/issues/`.
