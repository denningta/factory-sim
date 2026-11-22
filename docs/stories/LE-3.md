---
id: LE-3
epic: Layout editor
points: 3
priority: Must
sprint: 2
depends_on: [LE-2]
builder_model: sonnet
owner: builder
issue: 14
---

# LE-3: Undo and redo

**Story:** As a manufacturing engineer, I want undo and redo so that I can experiment without fear.

## Acceptance criteria

- [ ] Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z redoes
- [ ] At least 50 steps of history
- [ ] Covers placing, moving, editing properties, connecting and deleting

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- From the WS-1 review (#68): every keystroke in a properties field commits a store write (typing `12.5` writes 1, 12, 12., 12.5). Coalesce edits per field focus, or per blur/Enter, so one edit is one undo step.
