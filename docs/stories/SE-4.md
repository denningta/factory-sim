---
id: SE-4
epic: Simulation engine
points: 3
priority: Must
sprint: 5
depends_on: [SE-1]
builder_model: sonnet
owner: builder
issue: 31
---

# SE-4: Set warm-up period, run length and random seed

**Story:** As a manufacturing engineer, I want to set warm-up period, run length and random seed so that results are valid and repeatable.

## Acceptance criteria

- [ ] Run length in hours or shifts; warm-up period excluded from statistics
- [ ] The same seed and model always give identical results
- [ ] The seed can be fixed or randomized
- [ ] Shift length can be set (default 8 h), and run length in shifts and per-shift demand (PR-4) use it

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-23):_ the shift-length criterion was added with product-owner approval. Nothing in the editor sets `project.calendar.shiftLength` yet (PR-4 reads it). Store it in seconds. Changing it also changes the per-shift release interval (PR-4: shift length ÷ total units).
- Build on the run session from SE-3 (`apps/web/src/sim/`, see issue #30) rather than a separate runner.
- _Builder:_ run settings (warm-up, run length + unit, seed fixed/random, shift length) live in a panel on the Simulate screen and apply together via **Apply**, which starts a fresh run. They are session-only (the schema has no field for them) except shift length, which is stored as `calendar.shiftLength` (seconds) and autosaved. A random seed is drawn once per Apply and shown as "Seed used", so a result can be reproduced by switching to Fixed.
