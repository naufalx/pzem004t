# DESIGN SYSTEM: IoT Smart kWh Meter Web UI

## Surface Mode
- **Mode**: `Operate`
- **Context**: Embedded IoT Control Panel & Monitoring Dashboard (ESP32 LittleFS)
- **Primary Goal**: Rapid scanability, zero visual clutter, robust responsive layouts (mobile & desktop), real-time status visibility (WebSocket & sensor connection).

---

## Color Tokens & Palette

### Backgrounds & Surfaces
- Canvas / App Background: `#070e17` (`var(--bg)`)
- Sidebar Navigation: `#09121d` (`var(--sidebar)`)
- Primary Cards & Panels: `#101923` (`var(--panel)`) with subtle gradient `#121c27` to `#0e1721`
- Secondary Panels / Insets: `#121d29` (`var(--panel2)`)
- Card Borders & Dividers: `#22303e` (`var(--border)`)

### Typography Colors
- Primary Heading & High Contrast Text: `#f3f6fa` (`var(--text)`)
- Secondary / Labels / Units: `#dce3ea`
- Muted Text / Timestamps / Hints: `#9ca9b8` (`var(--muted)`)
- Subtitle / Explainer: `#8e9baa`

### Metric-Specific Semantic Accents
- **Voltage ($V$)**: `#2385ff` / `#3b8dff` (Electric Blue)
- **Current ($A$)**: `#38d05b` / `#45d75b` (Neon Emerald)
- **Power Factor ($PF$)**: `#f5b82e` / `#f3b92f` (Amber Warning Gold)
- **Active Power ($W$)**: `#9b5de5` / `#a46de4` (Electric Violet)
- **Status Online**: `#38d05b` with glowing drop-shadow `rgba(56, 208, 91, 0.7)`
- **Status Offline / Alarm**: `#ff4d4d` (`var(--danger)`) with warning shadow

---

## Typography Hierarchy
- **Font Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
- **Metric Values (Live Numbers)**: `32px`, font-weight `700`, tabular figures (`font-variant-numeric: tabular-nums`)
- **Metric Units**: `17px`, font-weight `400`
- **Card Titles & Headers**: `16px`–`20px`, letter-spacing `0.5px`
- **Small Badges & Timestamps**: `11px`–`12px`

---

## Craft Floor & Rules of Engagement (Impeccable Guidelines)

1. **Tabular Numerals**: Every live telemetry number must use `font-variant-numeric: tabular-nums` to avoid jitter when digits change.
2. **Smooth Meters**: Progress / gauge bars use `transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1)`.
3. **Responsive Breakpoints**:
   - `Desktop (> 1024px)`: 4-column metric grid, fixed 265px sidebar.
   - `Tablet (768px – 1024px)`: 2-column metric grid.
   - `Mobile (< 768px)`: 1-column metric grid, drawer sidebar toggled via hamburger menu button, bottom-pinned CTA.
4. **Offline & Reconnect State**: When WebSocket is disconnected, status badge changes immediately to `#ff4d4d` with clear *"Terputus - Mencoba menyambung..."* feedback.
