---
id: SE-5
epic: Simulation engine
points: 3
priority: Must
sprint: 5
depends_on: [PR-3, TE-1, FL-3]
builder_model: sonnet
issue:
---

# SE-5: The model checked before a run

**Story:** As a manufacturing engineer, I want the model checked before a run so that I don't waste time on a broken setup.

## Acceptance criteria

- [ ] Checks: every product has a routing and cycle times, routing steps are reachable, manual stations have techs, a source and sink exist
- [ ] Issues are listed; clicking one selects the object
- [ ] A run cannot start while blocking errors remain

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
