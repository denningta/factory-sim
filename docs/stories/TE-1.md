---
id: TE-1
epic: Technicians
points: 5
priority: Must
sprint: 4
depends_on: [WS-1]
builder_model: sonnet
owner: builder
issue: 33
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

- **Kernel pattern for a station with several assigned techs** (engine API, `WaitHandle`): model each tech as its own `Resource` (capacity 1) and request all of them. When the first grant arrives, `cancel()` the others. A `cancel()` that returns false means that tech was granted too (both were free at once), so `release` it right away. Without this, a tech stays reserved and idle. Because grants are delivered as events, that extra tech's `onGranted` still runs later: keep a per-station "served" flag and make every `onGranted` after the first a no-op (its unit was already released or withdrawn). Request techs in a fixed order (their order in the project) so the choice never depends on how a collection happens to be iterated.
