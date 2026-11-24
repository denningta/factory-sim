---
id: EQ-4
epic: Equipment library
points: 3
priority: Should
sprint: 6
depends_on: [EQ-3, FL-1]
builder_model: sonnet
owner: builder
issue: 7
---

# EQ-4: Define where parts enter and leave a piece of equipment

**Story:** As a manufacturing engineer, I want to define where parts enter and leave a piece of equipment so that connections and walking paths are realistic.

## Acceptance criteria

- [ ] Each type has input and output points on its footprint, editable in the type definition
- [ ] Connections attach to those points
- [ ] Defaults: input on one side, output on the opposite side

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- Ports already exist in schema v3, with defaults from `defaultPorts(behavior)`: input at `v = −0.5`, output at `v = +0.5`. This story adds _editing_ them in the type definition (EQ-3).
- Design (EQ-4): the type editor edits each existing port as a footprint side (back/front/left/right) plus an offset along that edge (% of the edge, −50…50), stored as the schema's `u`/`v` fractions. Port ids and count are kept, so connections stay valid; changing behavior (new types only) resets to that behavior's defaults. Adding/removing extra ports is not in scope. "Update instances" already copies ports and refuses via the project schema if a connection would dangle.
