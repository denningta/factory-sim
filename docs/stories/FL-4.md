---
id: FL-4
epic: Flow & connections
points: 2
priority: Should
sprint: 4
depends_on: [FL-1, SE-6]
builder_model: sonnet
owner: builder
issue: 11
---

# FL-4: Set transfer time on a connection

**Story:** As a manufacturing engineer, I want to set transfer time on a connection so that material movement time is included.

## Acceptance criteria

- [ ] Transfer time can be fixed or calculated from distance and speed
- [ ] Parts in transit count as WIP

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (schema v4):** `connection.transfer = {kind: 'instant'} | {kind: 'fixed', time: Duration} | {kind: 'speed', speed}`; distance is between the two ports' world positions (the FL-1 helper). AC2 'parts in transit count as WIP' is in SE-6's `RunStats.averageWip`.
- **Builder (FL-4):** Properties panel for a selected connection gains a "Transfer time" group: Instant / Fixed time (seconds) / From distance and speed (speed in ft/min or m/s per display unit; shows the port-to-port distance and resulting time). `updateConnection` now takes `{capacity?, transfer?}`. Fixed time is edited as a plain `fixed` duration; other distributions stay in the schema but have no UI. AC2 was already delivered by SE-6; FL-4 adds an engine regression test (Little's law check).
