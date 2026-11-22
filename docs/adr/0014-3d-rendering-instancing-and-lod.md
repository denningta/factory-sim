# ADR-0014: 3D rendering with instancing, LOD and segment tracks

- **Status:** Proposed (from the PL-5 spike; needs product-owner sign-off)
- **Date:** 2026-11-22

## Context

ADR-0002 (React Three Fiber) and ADR-0008 (renderer interpolates engine events on its own clock) were accepted on condition that the PL-5 spike confirmed performance. The spike (`docs/spikes/PL-5-rendering.md`, prototype in `spikes/pl-5-rendering/`) rendered 200 equipment objects and 500 moving parts in four configurations on an Intel UHD 630 laptop GPU in Chromium:

- **At the target load,** every configuration holds the 60 fps vsync cap (target: 30 fps), naive meshes included.
- **At 10× and 20× the load,** distance-based LOD is the only technique with a clear, repeated advantage. At 20×, instancing + LOD averages 50 fps and naive + LOD 36 fps.
- **Instancing alone** was _slower_ than naive meshes on this GPU (cause not isolated). Its expected benefit, lower CPU submit cost, wasn't measurable on the fast test CPU.
- **Position updates:** interpolating positions from timestamped segments with a per-part cursor keeps the scene's per-frame JS updates (part interpolation plus equipment LOD and matrix writes) at about 0.2 ms.

## Decision

The 3D view in `apps/web`:

1. **Uses LOD by camera distance:** two or three levels per equipment type (detailed, box, optionally hidden). The distance metric is chosen deliberately: the spike used horizontal distance only.
2. **Uses `InstancedMesh`** for repeated geometry: one per (equipment type, LOD level) and one for parts. The draw-call budget stays in the low tens. This rests on argument, not measurement, and the weaker-machine rerun (below) has to confirm it.
3. **Keeps per-frame work out of React:** `useFrame` writes instance matrices from refs. React and Zustand hold only editor state (selection, config). Static equipment matrices are rewritten only when the layout or the LOD split changes (the camera moved enough), not every frame.
4. **Implements ADR-0008 as segment tracks:** the engine's movement events `{part, t0, t1, from, to}` are appended to per-part tracks. The renderer interpolates them with a forward-only cursor that is only a cache, so speed changes and reset stay correct and never touch results.
5. **Budget:** plan for at most about 275k visible triangles at full detail. That's the measured count at the vsync cap on UHD 630. LOD keeps the typical frame well below it.
6. **Doesn't add shadows, post-processing or GPU picking without re-measuring.** None of them was tested.

## Consequences

- Positive: ADR-0002 and ADR-0008 are confirmed on UHD 630 / Chromium with a fast CPU, with measured headroom (≥ 10× the target load). The weaker-machine rerun is still pending. The renderer design is settled before SE-3 and LE-2 start.
- Negative: instancing makes per-object picking and highlighting more work, since it needs instance ids. The weaker-machine risk is still open: we need a rerun on a weaker-CPU laptop, a UHD 620-class GPU, and Firefox and Safari (command in the spike write-up). If instancing doesn't pay off there, decision 2 is revisited; decisions 1 and 3–6 stand either way.
- The spike didn't exercise the streamed-event path (appending to live tracks). SE-3 owns that, with tests.

## Alternatives considered

- Naive meshes only: they meet the target today, but have the least headroom and a draw call per object.
- Vanilla three.js without React: not needed, because React stays out of the frame loop.
- A render loop driven by the simulation: rejected in ADR-0008.
