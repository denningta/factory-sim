---
id: FL-3
epic: Flow & connections
points: 5
priority: Must
sprint: 4
depends_on: [PR-2, FL-1, SE-6]
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

- Runs on the line model (SE-6): at a split, route each part by its next routing step using the PR-2 reachability function. 'No path' becomes a `ModelIssue` with code `no_path` (`compileLine` fails).
- FL-3 builder: SE-6's `compileLine` already resolves each product's route by shortest path through buffers/conveyors (never across another workstation) and reports `no_path`, so split routing worked before this story. FL-3 adds the split-topology tests only; no engine change.
