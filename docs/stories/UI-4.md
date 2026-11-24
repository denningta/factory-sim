---
id: UI-4
epic: UI polish
points: 3
priority: Must
sprint: 8
depends_on: [UI-1, UI-6]
builder_model: sonnet
owner: builder
issue: 147
---

# UI-4: Simulate screen: floating controls and live tiles

**Story:** As a manufacturing engineer, I want the simulate screen to keep the line in view with only the live figures beside it so that I can watch the run without hunting through tables.

## Acceptance criteria

- [ ] The playback controls float over the top-left of the 3D viewport: Play, Pause, Step, Reset, Run to end, speed slider with `N×` readout, Animate toggle and the `Day N, hh:mm:ss` clock. SE-2, SE-4 and SE-8 tests pass unchanged apart from selectors
- [ ] **Live KPIs** as a strip of four tiles with icons across the top of the 3D viewport, as in the control-room reference: Throughput /hr, WIP units, Lead time min, Bottleneck (station name and working %), each with a per-product sub-line (e.g. `A 12 · B 8`) and a "warm-up excluded" note (product owner, 2026-11-24)
- [ ] The model check (SE-5) shows as a banner: success tone "Model check passed · 0 errors", or danger tone with the issue list; clicking an issue still navigates to its object
- [ ] Run settings sit in a collapsible Section below the tiles, collapsed after Apply
- [ ] The utilization tables are removed from this screen (product owner, 2026-11-23); a "See full results →" link opens Results
- [ ] `simulation/` joins the no-`style` lint scope; screenshot in `docs/screenshots/UI-4/`

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ files: `simulation/SimulateScreen.tsx`, `KpiPanel.tsx`, `BottleneckTile.tsx`, `RunSettingsPanel.tsx`. Prototype reference: `.hud` in [`docs/wireframes/prototype/prototype.css`](../wireframes/prototype/prototype.css) and [`layout.html`](../wireframes/prototype/layout.html). Depends on UI-6 because the utilization tables move there. Not run at the same time as UI-5: both change `simulation/`.
- _Lead (2026-11-24):_ **redesign toward the control-room look** (product owner, 2026-11-24): see [`docs/wireframes/reference/`](../wireframes/reference/README.md). Load the `frontend-design` skill (and `dataviz` for charts, tiles, legends, bars) and add a Design section to the PR (builder role). Colours come from the active theme (UI-9).
