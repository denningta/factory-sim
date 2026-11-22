---
id: LE-1
epic: Layout editor
points: 5
priority: Must
sprint: 1
depends_on: [PL-5]
builder_model: sonnet
owner: builder
issue: 12
---

# LE-1: Set the floor's real dimensions and units

**Story:** As a manufacturing engineer, I want to set the floor's real dimensions and units so that my layout matches the actual building.

## Acceptance criteria

- [ ] I can set floor width and length in ft or m
- [ ] A grid with adjustable spacing is drawn to scale, with labeled dimensions
- [ ] Switching units changes the display only, never the stored geometry
- [ ] Snap-to-grid can be toggled

## Notes

- Floor lives in a Zustand store (`apps/web/src/layout/editorStore.ts`) as the schema's `Floor` (meters); edits are validated with `floorSchema` plus a max-grid-lines guard (500 per axis).
- Unit (default ft) and snap (default on) are UI prefs kept in the store and `localStorage`, never in the document. ft↔m conversion (exact 0.3048) happens only in `units.ts`, at the input/label boundary.
- Snap has no consumer until LE-2 (placement); LE-1 provides the toggle and `snapToGrid()`.
- ADR-0014 was referenced in the lead's notes but is not on `main`; followed the notes instead.
- The web app had no scaffold; this story adds Vite, React, R3F, drei and Zustand to `apps/web`.
