---
id: WS-3
epic: Workstation config
points: 3
priority: Must
sprint: 4
depends_on: [SE-1, SE-6]
builder_model: sonnet
owner: builder
issue: 37
---

# WS-3: Set a station's capacity and batch size

**Story:** As a manufacturing engineer, I want to set a station's capacity and batch size so that parallel fixtures and batch processes are modeled.

## Acceptance criteria

- [ ] Capacity = units processed at the same time
- [ ] Batch size = units that must accumulate before processing starts
- [ ] The simulation honors both (verified by a test model)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Lead decision (schema v2, #55):** `batchSize ≤ capacity`, enforced by the schema. A batch is loaded and processed together, so a batch larger than the station's capacity is rejected. If the product owner wants multi-cycle batches instead, that's a schema change through the lead.
