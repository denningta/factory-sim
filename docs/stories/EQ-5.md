---
id: EQ-5
epic: Equipment library
points: 3
priority: Should
sprint: 7
depends_on: [EQ-2]
builder_model: sonnet
owner: builder
issue: 73
---

# EQ-5: Draw calls per equipment type, not per size

**Story:** As a manufacturing engineer, I want large layouts with many resized objects to stay smooth so that the 3D view keeps up.

## Acceptance criteria

- [ ] One `InstancedMesh` set per (type, LOD level); size is encoded in the instance matrix, and parts that must not stretch (legs, rails, signal tower) keep their absolute size
- [ ] Test: N instances of one type in N different sizes give a constant draw-call count
- [ ] Rechecked against the PL-5 measurement method (ADR-0014 budget: low tens of draw calls)

## Notes

_Added by the lead or builder during the story: design decisions, open questions, links._

- _Lead (2026-11-24):_ from the review of #72 (issue #73).
- _Builder:_ groups are keyed by `(typeId, color)`. Each instance's parts are still computed by `equipmentParts` at its own size; the layer writes size into the instance matrix (`partScale` on a unit box / unit cylinder), so rails, legs and the signal tower keep exactly the absolute sizes they had. LOD levels do not exist yet (ADR-0014); when they do, the key gains the level. Draw calls = parts per type (workstation 3, buffer 14, conveyor 7, source 3, sink 5), independent of size.
- _Builder, AC3 measurement (PL-5 method: `gl.info.render.calls` on a rendered frame, headless Chromium + SwiftShader, 1280×800):_ 20 instances (7 workstations, 7 buffers, 6 conveyors), every one a different size, 5 colors. **main: 133 calls → this branch: 20 calls** (= 3 + 10 + 7 parts, the per-type constant). Same layout renders identically: `docs/screenshots/EQ-5/before-main.png`, `after.png`. Harness lived in a git-ignored `apps/web/.vite/harness`, not committed. Color is a per-instance tint, so groups key on type only.
