---
id: SE-7
epic: Simulation engine
points: 2
priority: Must
sprint: 6
depends_on: [SE-4]
builder_model: sonnet
owner: builder
issue: 116
---

# SE-7: Run settings saved with the project

**Story:** As a manufacturing engineer, I want warm-up, run length and seed saved with my project so that I don't re-enter them each session and can reproduce a run.

## Acceptance criteria

- [ ] Warm-up, run length (hours or shifts) and seed mode/value are restored after reload
- [ ] Changing them marks the project dirty and autosaves; undo reverts them
- [ ] Apply refuses a warm-up that is not shorter than the run length (in shifts, using `calendar.shiftLength`)
- [ ] A random-seed run still shows the seed used, and switching back to Fixed restores the saved value

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-23):_ product-owner decision. Schema v5 (#117) adds `project.run`: `warmUp` seconds, `length` {unit `seconds` | `shifts`, value}, `seed` {mode, value}. Hours in the UI = seconds / 3600. Save through `documentForSave` like `shiftLength` (SE-4), and include it in the editor undo snapshot.
