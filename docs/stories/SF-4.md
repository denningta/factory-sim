---
id: SF-4
epic: Shop floor
points: 3
priority: Must
sprint: 9
depends_on: [SF-3]
builder_model: sonnet
owner: builder
issue: 175
---

# SF-4: Clear, quiet in/out ports

**Story:** As a manufacturing engineer, I want ports labelled IN and OUT that stand out only when I need them so that connecting stations is obvious but the 3D view stays calm.

## Acceptance criteria

- [ ] The green and red spheres are replaced by small flat markers labelled **IN** and **OUT**, in muted theme colours
- [ ] Hovering a port enlarges it and shows a hint ("Output: click to connect", "Input")
- [ ] In connect mode, valid inputs for the pending output are highlighted and other ports dim
- [ ] Once a port is connected it shrinks to a small, dim dot; it returns to full size on hover or in connect mode. Test: connected vs unconnected marker scale/opacity
- [ ] Ports are not drawn in Simulate. Existing connect tests (FL-1) pass apart from selectors
- [ ] Screenshots in `docs/screenshots/SF-4/`: unconnected, connect mode, connected

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ ports are drawn in `layout/ConnectionLayer.tsx` (same file as SF-3, hence the dependency); positions from `layout/ports.ts`.
