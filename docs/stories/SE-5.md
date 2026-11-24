---
id: SE-5
epic: Simulation engine
points: 3
priority: Must
sprint: 5
depends_on: [PR-3, TE-1, FL-3]
builder_model: sonnet
owner: builder
issue: 32
---

# SE-5: The model checked before a run

**Story:** As a manufacturing engineer, I want the model checked before a run so that I don't waste time on a broken setup.

## Acceptance criteria

- [ ] Checks: every product has a routing and cycle times, routing steps are reachable, manual stations have techs, a source and sink exist
- [ ] Issues are listed; clicking one selects the object
- [ ] A run cannot start while blocking errors remain

## Notes

- The checks live in the engine's `compileLine` (SE-6). SE-5 adds the missing `no_routing` check (product with an empty routing) and the UI: issues on the Simulate screen are buttons; clicking selects the equipment (routing-step ids resolve to their station) and switches to the Layout screen, or the Products screen for a product issue.
- A run can't start because `createRunSession` returns no session while `compileLine` reports errors; the playback controls only render with a session.
