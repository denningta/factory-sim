---
id: PL-3
epic: Platform
points: 3
priority: Must
sprint: 1
depends_on: []
builder_model: sonnet
owner: lead
issue: 19
---

# PL-3: A versioned project data schema

**Story:** As a developer, I want a versioned project data schema so that projects saved today still open after future releases.

## Acceptance criteria

- [ ] Every saved project carries a schema version
- [ ] Saves are validated; invalid data is rejected with a clear message
- [ ] An upgrade step can convert an older version to the current one (tested with a sample)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **API** (`@factory-sim/schema`): `validateProject` on save (must be current version), `loadProject` on open (upgrade chain, then validate), `createProject`, `projectSchema` + inferred types, `createUpgrader`.
- **v1 document** = editable content only: `floor`, `equipment`, `connections`, `products` (with embedded `routing`), `cycleTimes` keyed by (product, station). Project id/name/owner/timestamps are relational columns (ADR-0004). Display units and editor preferences (e.g. snap toggle) are not stored.
- Cross-reference rules enforced: unique ids, unique part numbers, no self-connections, references resolve, routing steps and cycle times point at workstations.
- `time` is a discriminated union (`{ kind: 'fixed', value }`) so PR-4 adds distributions as new kinds (with a version bump and a trivial upgrade step). Every schema change bumps `schemaVersion`, additive ones included, so an older build reports "saved by a newer version" instead of "unrecognized key".
- **AC3 reading:** v1 is the first version, so there is no real older version yet. The upgrade mechanism is tested with a sample v1→v2→v3 chain in the test file; the production chain (`upgradeSteps`) is empty until the first breaking change.
