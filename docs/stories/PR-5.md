---
id: PR-5
epic: Products & routings
points: 2
priority: Should
sprint: 7
depends_on: [PR-4]
builder_model: sonnet
owner: builder
issue: 100
---

# PR-5: Demand mix editor polish

**Story:** As a manufacturing engineer, I want the demand mix editor to behave predictably so that undo and rescaling never surprise me.

## Acceptance criteria

- [ ] Undo/redo restores which products are pinned (`editedDemand` cleared or snapshotted)
- [ ] A hint shows when editing a value rescales every other product
- [ ] The remaining-percentage check compares in hundredths, so float error never blocks a valid entry

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ from the #99 re-review (issue #100).
