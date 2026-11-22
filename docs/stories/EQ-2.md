---
id: EQ-2
epic: Equipment library
points: 3
priority: Must
sprint: 2
depends_on: [EQ-1]
builder_model: sonnet
owner: builder
issue: 5
---

# EQ-2: Set each object's real footprint and height

**Story:** As a manufacturing engineer, I want to set each object's real footprint and height so that the layout is to scale.

## Acceptance criteria

- [ ] Length, width and height are editable in the current units
- [ ] The 3D object resizes immediately
- [ ] Clearance checks (LE-5) use the real footprint

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- From the WS-1 review (#68): conveyor speed displays in m/s even in ft mode. Show it in ft/min when the display unit is ft (display-only conversion; stored value stays m/s). Multi-selection with mixed rotations still shows "0"; show it as mixed.

- From the EQ-1 review (#61): conveyor legs sit at `z = ±0.45·l` with thickness `0.12·w`, which can leave the footprint when a conveyor is short and wide. Clamp it, and add a test that every shape stays inside its footprint for edited dimensions.

- Design (builder): width/length/height are fields in the WS-1 properties panel (display unit, stored in meters); zero/negative sizes are rejected inline by the schema rule. The layer groups instances by (type, footprint, height) and builds each group's parts from the instance's own settings, so the instance footprint is the single source for rendering and picking.
- AC3 reading: LE-5 doesn't exist yet; satisfied by that single-source rule plus a test that a resized instance's rendered bounds equal its footprint. LE-5 should read `Equipment.footprint` (rotated by `rotation`).
- Conveyor legs now clamp inside the footprint; the workstation signal tower radius scales with the shorter side. Speed shows as ft/min in ft mode; mixed rotations show a "Mixed" placeholder.
