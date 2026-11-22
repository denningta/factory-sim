---
id: FL-3
epic: Flow & connections
points: 5
priority: Must
sprint: 4
depends_on: [PR-2, FL-1]
builder_model: sonnet
owner: builder
issue: 10
---

# FL-3: Parts to follow their product's routing where flow splits

**Story:** As a manufacturing engineer, I want parts to follow their product's routing where flow splits so that mixed-model flow is correct.

## Acceptance criteria

- [ ] At a station with several outgoing connections, each part takes the path to its next routing step
- [ ] If no path exists, the run is blocked with a clear validation error

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
