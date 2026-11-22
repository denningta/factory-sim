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
- Design (LE-3): the editor store keeps a session-only snapshot history (`{floor, equipment}`, capped at `HISTORY_LIMIT` = 100) outside the project document; `loadDocument` clears it. Each successful write records one step; failed edits record nothing. Properties and Floor fields call `beginEdit` on focus and `endEdit` on blur or Enter, so one field edit is one step and a session that changed nothing leaves none. Undo/redo write the store's document, so SC-1 autosave saves them.
- Connecting: no connections exist in the editor yet (FL-1). When FL-1 adds them, add `connections` to the history `Snapshot` and to `loadDocument`; connect/disconnect then call the same `record()` and undo with no other change.
- Shortcuts live in `layout/shortcuts.ts` (Ctrl/Cmd+Z, +Shift+Z, also Ctrl/Cmd+Y) and are ignored while a text field has focus.
- Undo and redo restore the document only, not the selection; ids that no longer exist are dropped from the selection, but a restored item is not re-selected.
