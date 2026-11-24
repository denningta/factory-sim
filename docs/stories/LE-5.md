---
id: LE-5
epic: Layout editor
points: 3
priority: Should
sprint: 6
depends_on: [LE-2]
builder_model: sonnet
owner: builder
issue: 16
---

# LE-5: Overlapping equipment flagged

**Story:** As a manufacturing engineer, I want overlapping equipment flagged so that my layout is physically possible.

## Acceptance criteria

- [ ] Objects whose footprints overlap turn red
- [ ] Optional minimum clearance distance (e.g., 3 ft) also flags too-close objects
- [ ] A count of issues shows in the toolbar

## Notes

- Footprints are oriented rectangles (position, rotation, footprint); overlap via separating-axis test, gap via vertex-to-edge distance. Touching is not overlapping.
- One issue = one flagged pair. Overlap wins over too-close, so a pair counts once. Red tint: strong for overlap, lighter for too-close.
- Clearance is a UI/editor setting (meters in the store, shown in the display unit); not persisted in the project document (no schema change). Blank = off.
- Red tint updates on commit, not live during a drag preview.
