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
- [ ] Each cell takes a fixed time or a distribution (see WS-2)
- [ ] Missing cycle times are flagged before a run
- [ ] Import from CSV/paste from Excel

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- Cycle times exist in the schema keyed by (product, station) with `time: { kind: 'fixed', value }` (seconds). **Distributions (AC2) are defined with WS-2/PR-4 in Sprint 4**, so this story ships fixed times and a cell UI that can take another `kind` later. Note the partial AC2 in the PR. CSV/paste import parses into the same schema (seconds; accept mm:ss as display input).
