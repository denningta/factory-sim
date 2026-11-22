---
id: TE-1
epic: Technicians
points: 5
priority: Must
sprint: 4
depends_on: [WS-1]
builder_model: sonnet
issue:
---

# TE-1: Create technicians and assign them to stations

**Story:** As a manufacturing engineer, I want to create technicians and assign them to stations so that labor is part of the model.

## Acceptance criteria

- [ ] Create techs with name and walk speed (default 1.2 m/s)
- [ ] Assign a tech to one or more stations
- [ ] Each station is either manual (tech present for the whole cycle) or automatic (tech only for load/unload time)
- [ ] A manual station with no tech is flagged before a run

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
