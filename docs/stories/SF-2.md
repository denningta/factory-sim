---
id: SF-2
epic: Shop floor
points: 3
priority: Must
sprint: 9
depends_on: [SF-1]
builder_model: sonnet
owner: builder
issue: 173
---

# SF-2: Technician figure at the bench

**Story:** As a manufacturing engineer, I want technicians drawn as people standing where they really work so that I can see who is at which bench and who is walking.

## Acceptance criteria

- [ ] Technicians are a simplified person figure (head, torso, arms, legs) with a badge or vest in the tech's colour, within 1,500 triangles, instanced
- [ ] At a station the figure stands at the `operator` anchor, outside the bench, facing it, in a working pose (arms forward)
- [ ] While walking it faces the direction of travel, arms down, with a simple walk cycle driven by the sim clock (ADR-0008)
- [ ] Two or more techs at one station stand side by side along the front edge, not overlapping. Test: positions distinct and outside the footprint
- [ ] Turning animation off and on (TE-3) still restores positions; name labels still show
- [ ] Screenshot in `docs/screenshots/SF-2/`

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-26):_ sprint 9 "Shop floor in 3D" (product owner, 2026-11-26). Load the `frontend-design` skill and add a Design section to the PR. Colours come from the active theme (UI-9). ADR-0014 budget: draw calls in the low tens, ≤ 275k visible triangles.
- _Lead:_ files: `simulation/TechLayer.tsx`, `simulation/techTracks.ts`. Prototype: `operator` + `poseOperator` in `models.js` (simplify: fewer segments, no glasses).
- _Lead (2026-11-26):_ from the SF-1 review (#184): the `operator` anchor sits 0.45 m in front of the +z edge, the same side as the default output port, so a tech can stand on an outgoing conveyor. Decide where techs stand here; the TypeEditor default label ignores params (automatic types say "Workbench").
- _Builder (SF-2):_ no tech colour in the schema (lead decision, review of #190): the vest takes a stable colour from the fixed categorical `scene.techs` theme palette by the tech's order in `project.technicians` (state colour no longer used). Stand spot = the `operator` anchor (in front of the bench, outside the footprint), shifted along the front edge by 0.7 m per tech sharing the bench (fixed slots from `stationIds`). The output-port overlap from the SF-1 review is not addressed: a follow-up (needs the port side).
- _Builder (SF-2):_ operator spot stays at the anchor on purpose: `techTracks` doesn't know which side the output port is, and moving it is an SF-1/anchor concern. Spread of 0.7 m per tech is not clamped to the bench width (4+ techs can overhang a 2 m bench).
