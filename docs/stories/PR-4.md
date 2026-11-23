---
id: PR-4
epic: Products & routings
points: 5
priority: Must
sprint: 4
depends_on: [PR-1, SE-6]
builder_model: sonnet
owner: builder
issue: 26
---

# PR-4: Set demand mix and release rules

**Story:** As a production manager, I want to set demand mix and release rules so that the simulation reflects how we actually schedule work.

## Acceptance criteria

- [ ] Demand per product as units per shift or % of mix
- [ ] Release rule options: fixed interval, random by mix, repeating sequence (heijunka pattern)
- [ ] Over a long run, released quantities match the mix within 2%

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
