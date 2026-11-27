---
id: SF-8
epic: Shop floor
points: 3
priority: Must
sprint: 9
depends_on: [SF-1, SF-2, SF-3, SF-4, SF-5, SF-7]
builder_model: sonnet
owner: builder
issue: 179
---

# SF-8: Shop-floor scene and performance

**Story:** As a manufacturing engineer, I want the 3D line framed and lit like a real shop floor, and smooth on my machine, so that I can show it to colleagues.

## Acceptance criteria

- [ ] An isometric-style default camera (about 35° elevation, 45° azimuth) that frames the equipment whenever equipment exists
- [ ] Dark floor with a faint grid, background and lights from the active theme (UI-9); equipment in pale, low-contrast materials with the equipment colour as accent, as in the control-room reference. No shadows (ADR-0014)
- [ ] **Performance:** at the PL-5 target load (200 objects, 500 parts), `renderer.info` shows draw calls in the low tens and at most 275k visible triangles; numbers recorded in the PR. The product owner confirms ≥ 30 fps on the reference machine before merge
- [ ] Screenshots in `docs/screenshots/SF-8/`: reference line in 3D, dark and light

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ carried over from UI-8 (closed). Prototype: [`scene.js`](../wireframes/prototype/scene.js).
- _Builder (2026-11-26):_ **Perf (dev server, Chromium, 200 equipment on a 60 × 60 m floor):** Layout 21 draw calls / 33k triangles; Simulate running 46 draw calls / 65k triangles (parts are one instanced mesh whatever their count). Before: 919 and 854 calls. Equipment is batched per (material role, unit geometry) across models and LODs (`planBatches`); station stack lights are 4 instanced meshes, outlines one merged vertex-coloured mesh, port markers 3 instanced meshes; callout cards are a pool of the 6 stations nearest the camera plus the bottleneck. `window.__rendererInfo` (dev only) exposes `renderer.info` for the check. Body colour is the equipment colour toned 65% toward the theme's pale accent (`BODY_PALE`).
