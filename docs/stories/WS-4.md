---
id: WS-4
epic: Workstation config
points: 1
priority: Should
sprint: 7
depends_on: [WS-3, TE-1]
builder_model: sonnet
owner: builder
issue: 103
---

# WS-4: Hint when manual stations are limited by techs

**Story:** As a manufacturing engineer, I want to be told when a manual station's capacity exceeds its assigned techs so that I don't expect parallel units I won't get.

## Acceptance criteria

- [ ] The hint shows for a manual station with capacity > assigned techs, and updates when techs or capacity change
- [ ] No hint for automatic stations, or when techs ≥ capacity

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ product-owner approved (issue #103). Example text: "Parallel units limited by assigned techs (1)", next to Capacity in the Properties panel.
