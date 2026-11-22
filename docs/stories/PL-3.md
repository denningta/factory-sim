---
id: PL-3
epic: Platform
points: 3
priority: Must
sprint: 1
depends_on: []
builder_model: sonnet
issue:
---

# PL-3: A versioned project data schema

**Story:** As a developer, I want a versioned project data schema so that projects saved today still open after future releases.

## Acceptance criteria

- [ ] Every saved project carries a schema version
- [ ] Saves are validated; invalid data is rejected with a clear message
- [ ] An upgrade step can convert an older version to the current one (tested with a sample)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
