---
id: EQ-5
epic: Equipment library
points: 3
priority: Should
sprint: 7
depends_on: [EQ-2]
builder_model: sonnet
owner: builder
issue: 73
---

# EQ-5: Draw calls per equipment type, not per size

**Story:** As a manufacturing engineer, I want large layouts with many resized objects to stay smooth so that the 3D view keeps up.

## Acceptance criteria

- [ ] One `InstancedMesh` set per (type, LOD level); size is encoded in the instance matrix, and parts that must not stretch (legs, rails, signal tower) keep their absolute size
- [ ] Test: N instances of one type in N different sizes give a constant draw-call count
- [ ] Rechecked against the PL-5 measurement method (ADR-0014 budget: low tens of draw calls)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ from the review of #72 (issue #73).
