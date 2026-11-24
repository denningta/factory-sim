---
id: LE-6
epic: Layout editor
points: 1
priority: Should
sprint: 6
depends_on: [LE-5]
builder_model: sonnet
owner: builder
issue: 120
---

# LE-6: Minimum clearance saved with the project

**Story:** As a manufacturing engineer, I want my minimum clearance saved with the layout so that the check is still on when I come back.

## Acceptance criteria

- [ ] The minimum clearance is restored after reload (empty = off)
- [ ] Changing it marks the project dirty and autosaves; undo reverts it

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-23):_ product-owner decision. Schema v6 adds `project.layout.minClearance` (meters, or `null` for off). Replace the session-only `clearance` in the editor store with it, save through `documentForSave` and include it in the undo snapshot (like `shiftLength` in SE-4).
