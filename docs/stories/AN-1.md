---
id: AN-1
epic: Analytics & KPIs
points: 5
priority: Must
sprint: 6
depends_on: [SE-4]
builder_model: sonnet
owner: builder
issue: 1
---

# AN-1: Throughput, WIP and lead time by product

**Story:** As a production manager, I want throughput, WIP and lead time by product so that I can judge whether the layout meets demand.

## Acceptance criteria

- [ ] Shows throughput (units/hour and units/shift), average WIP and average lead time, per product and in total
- [ ] Warm-up period excluded
- [ ] Updates live during a run; final values shown at the end
- [ ] Passes a Little's Law check (WIP ≈ throughput × lead time) within 5%

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
