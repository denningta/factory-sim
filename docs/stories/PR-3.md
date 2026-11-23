---
id: PR-3
epic: Products & routings
points: 5
priority: Must
sprint: 3
depends_on: [PR-2]
builder_model: sonnet
owner: builder
issue: 25
---

# PR-3: Enter cycle time per product per station

**Story:** As a manufacturing engineer, I want to enter cycle time per product per station so that work content differences between products are modeled.

## Acceptance criteria

- [ ] Editable product × station grid, filled only where the routing uses that station
- [ ] Each cell takes a fixed time (distributions per cell are WS-2's scope)
- [ ] Missing cycle times are flagged before a run
- [ ] Import from CSV/paste from Excel

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **AC change (product owner, 2026-11-22):** "or a distribution" moved to WS-2, so PR-3 ships complete with fixed times. Build the cell so WS-2 can add other `time.kind`s.
- From the PR-1 review (#81): move `cycleTimes` into the editor store and the LE-3 undo snapshot, so undoing a product delete also restores its cycle times.
