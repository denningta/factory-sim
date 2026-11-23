---
id: FL-1
epic: Flow & connections
points: 5
priority: Must
sprint: 3
depends_on: [LE-2]
builder_model: sonnet
owner: builder
issue: 8
---

# FL-1: Draw directed connections between equipment

**Story:** As a manufacturing engineer, I want to draw directed connections between equipment so that I define how material moves.

## Acceptance criteria

- [ ] Click an output, then an input, to create a connection drawn as an arrow
- [ ] Connections can be selected and deleted
- [ ] A connection cannot link an object to itself

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- **Contract (schema v3, lead):** every equipment has `ports` (`{id, kind: 'input'|'output', u, v}`; `u`/`v` are footprint fractions in the equipment's own frame, −0.5…0.5). A connection is `{id, from: {equipmentId, portId}, to: {equipmentId, portId}, capacity}`. The schema already rejects self-connections, output→output, unknown ports and duplicate links: use `validateProject`/the schema rather than re-implementing the rules.
- World position of a port = instance position + rotation applied to `(u·width, v·length)`. Put that in one pure, tested helper; FL-2/FL-3/SE-3 reuse it.
- New connections get `capacity: 0` (no buffer); editing capacity is FL-2.
- Add connect/disconnect to the LE-3 undo history (the hook is noted in `editorStore.ts`).
