---
id: UI-2
epic: UI polish
points: 3
priority: Must
sprint: 8
depends_on: [UI-1]
builder_model: sonnet
owner: builder
issue: 145
---

# UI-2: App shell: workflow tabs, status and Run simulation

**Story:** As a manufacturing engineer, I want the top bar to show the steps of my work in order and where something still needs attention so that I always know what to do next.

## Acceptance criteria

- [ ] The top bar matches wireframes 1, 3 and 4: product mark and "Flow Simulator", "← Projects", the project name, tabs **Layout · Products & routings · Simulate · Results** in that order, save status, and a primary **Run simulation** button
- [ ] **Run simulation** opens Simulate and starts playback. While pre-run issues exist (SE-5, `preRunIssues`), it is disabled and its accessible description lists them
- [ ] A tab shows a count badge of open problems on its screen: Layout = overlapping equipment (LE-5) plus **routed** manual stations with no tech (the same rule as SE-5's `manual_station_without_tech`, so the badge and the model check agree); Products & routings = missing products or cycle times. No badge when the count is 0. Test: each count updates when the cause is fixed
- [ ] The open tab is part of the URL (`#/p/<id>/<tab>`), so reload and the browser Back button keep the screen
- [ ] The Results tab exists. Until UI-6 it shows an EmptyState: "Run a simulation to see results"
- [ ] Save status uses Badge tones (saved = muted, unsaved/saving = neutral, error/conflict = danger); conflict and stopped behaviour is unchanged (existing tests pass)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ shell lives in `apps/web/src/projects/ProjectEditor.tsx` (header + tab state) and `App.tsx` (hash routing). Keep the hash format backward compatible: `#/p/<id>` opens Layout.
