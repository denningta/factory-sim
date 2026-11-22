---
id: WS-2
epic: Workstation config
points: 5
priority: Must
sprint: 4
depends_on: [PR-3]
builder_model: sonnet
owner: builder
issue: 36
---

# WS-2: Cycle times as fixed values or statistical distributions

**Story:** As a manufacturing engineer, I want cycle times as fixed values or statistical distributions so that variability is modeled realistically.

## Acceptance criteria

- [ ] Supported: fixed, normal (mean, std dev), triangular (min, most likely, max), lognormal, exponential
- [ ] A small histogram previews the distribution
- [ ] Negative samples are prevented (truncated)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._
