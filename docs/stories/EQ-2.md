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

- From the EQ-1 review (#61): conveyor legs sit at `z = ±0.45·l` with thickness `0.12·w`, which can leave the footprint when a conveyor is short and wide. Clamp it, and add a test that every shape stays inside its footprint for edited dimensions.
