---
id: UI-9
epic: UI polish
points: 4
priority: Must
sprint: 8
depends_on: [UI-1]
builder_model: sonnet
owner: builder
issue:
---

# UI-9: Dark control-room theme, with a light toggle

**Story:** As a manufacturing engineer, I want a dark control-room look by default, with the option to switch to light, so that the simulator reads like a line-monitoring display and suits my environment.

## Acceptance criteria

- [ ] `ui/tokens.ts` has a **dark** theme (the default) and the existing **light** theme with the same keys, including glow and elevation tokens (accent glow, panel border, raised surface). The dark palette follows the control-room reference: near-black background, dark panels with thin borders, a teal/emerald accent used sparingly
- [ ] A **theme toggle** (dark/light) in the account menu switches the whole app without a reload; the choice is remembered in this browser, and a new browser starts dark
- [ ] The **3D scene** (background, floor, grid, lights, equipment materials, labels) reads the active theme and switches with it, without remounting the canvas
- [ ] **Contrast test** over both themes: text and muted text on every surface ≥ 4.5:1; each state's strong colour (working, starved, blocked, waiting for tech, walking) ≥ 3:1 against the panel surface; state colours stay distinguishable from each other and from the accent
- [ ] Every screen migrated so far (UI-1's screens) looks right in both themes; no hard-coded colour remains in them
- [ ] Screenshots in `docs/screenshots/UI-9/`: each migrated screen and the 3D layout view, in dark and in light

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ product owner, 2026-11-24: redesign toward [`docs/wireframes/reference/control-room.png`](../wireframes/reference/README.md); dark by default with a light toggle. ADR-0016 is amended for this. Load the `frontend-design` skill and add a Design section to the PR. The reference pins the direction (dark with a teal accent), so follow it; spend boldness on the accent glow and keep the rest quiet.
- _Lead:_ runs right after UI-1 and before UI-2, UI-3, UI-5 and UI-6, so no screen is restyled twice. Keep the theme in a small store and the CSS variables on `:root` (`data-theme`); three.js materials subscribe to the store. Wrap `localStorage` access in try/catch.
- _Lead:_ the account menu moves into the top bar in UI-2; until then put the toggle where the account link is today.
