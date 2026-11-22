# PL-5 spike: three.js rendering approach

**Result: ADR-0002 stands. React Three Fiber is fine for 200 equipment objects and 500 moving parts.** The recommendation is instanced rendering plus distance-based LOD, with per-frame work kept out of React. The spike took well under the 3-day time box.

Prototype: `spikes/pl-5-rendering/` (throwaway; nothing in `apps/` or `packages/` imports it).

## What was built

- 200 pieces of equipment (about 1.5k triangles each, standing in for a real model) in a 20 x 10 grid, 5 m pitch.
- 500 parts (320-triangle icospheres) circulating on 10 conveyor loops.
- Four configurations, switchable on screen: naive meshes, naive + LOD, `InstancedMesh`, `InstancedMesh` + LOD.
- LOD swaps a 1.5k-triangle machine for a 12-triangle box beyond 45 m from the camera.
- Part motion is driven by timestamped segments `{t0, t1, from, to}`, the stand-in for ADR-0008 events. The renderer keeps its own clock and interpolates (`src/tracks.ts`, unit tested).
- `?x=N` scales both counts N times to find headroom. All meshes have frustum culling off, so every count is a worst case with everything on screen.

## Measurements

Machine: i9-9880H, **Intel UHD 630 (Mesa, via ANGLE)**, Chromium 155, Linux, 1280x800 window, vsync on (60 Hz cap). The browser chose the integrated GPU, so this is a reasonable proxy for a typical work laptop. Each cell is one 5 s run after warm-up (x1 was repeated several times with identical results).

**Target load (x1: 200 equipment + 500 parts):**

| config          | fps  | p95 frame ms | JS update ms | draw calls | triangles |
| --------------- | ---- | ------------ | ------------ | ---------- | --------- |
| naive           | 60.0 | 16.9         | 0.23         | 701        | 274,800   |
| naive + LOD     | 60.0 | 16.9         | 0.19         | 701        | 117,936   |
| instanced       | 60.0 | 16.9         | 0.16         | 3          | 274,800   |
| instanced + LOD | 60.0 | 16.9         | 0.16         | 4          | 117,936   |

All four hold the 60 fps vsync cap, well above the 30 fps criterion. The criterion is met even by the naive approach on integrated graphics.

**Headroom (the same four configs at 10x and 20x the target):**

| scale (equip / parts) | naive | naive + LOD | instanced | instanced + LOD |
| --------------------- | ----- | ----------- | --------- | --------------- |
| x10 (2,000 / 5,000)   | 57.7  | 60.0        | 44.0      | 60.0            |
| x20 (4,000 / 10,000)  | 36.2  | 41.0        | 25.7      | 55.4            |

### What the numbers say

- **At this scale the GPU is bound by triangles, not draw calls.** Even 7,000 naive draw calls at x10 still ran at about 58 fps. LOD is what buys headroom: it cuts triangles by 57%, and instanced + LOD was the only config over 50 fps at x20.
- **Instancing does not help on its own here.** Plain instanced was slower than naive at x10 and x20 with identical triangle counts. Its value is the draw-call count (3 vs 701) and CPU submit cost, which matter more on weaker CPUs and in the browser's single main thread, and which this GPU-bound test does not stress.
- **JS update cost is small:** about 0.16 ms/frame at x1 and about 1.5 ms at x20 for interpolating the parts and writing the matrices.

### Measurement pitfalls found (worth knowing for future perf work)

1. **Occluded windows are throttled to 1 Hz.** A Chrome window that is not frontmost drops `requestAnimationFrame` to about 1 fps (exact 1017 ms frames). `scripts/measure.mjs` launches its own Chromium with background throttling disabled.
2. **Do not benchmark with vsync off.** Frame times then measure CPU submit time while the GPU queue backs up, which gives absurd medians and multi-second stalls. Measure with vsync on and look at p95 and max.
3. **Animated instance buffers need `DynamicDrawUsage`** on `instanceMatrix`. Set it in the prototype from the start.

## Recommendation

1. **Instance anything repeated.** Use one `InstancedMesh` per (equipment type, LOD level) and one for parts. Keep the draw-call budget in the low tens: a few per equipment type plus parts plus selection and overlay. It is cheap and gives the CPU headroom.
2. **LOD by camera distance, in the same per-frame loop that writes matrices.** Use two or three levels (detailed, box, optionally hidden or a billboard). Budget on triangles: the target is 100-200k visible triangles for the whole scene, which at about 0.1 ms/frame is trivial on the CPU. Keep source models for equipment types light, since this iGPU is triangle-bound.
3. **Keep per-frame updates out of React.** Positions are written in `useFrame` directly into instance matrices from refs. React state is only for editor state (selection, config). The readout in the prototype also updates the DOM directly.
4. **Implement ADR-0008 as segment tracks with a forward-only cursor.** The engine emits movement events `{part, t0, t1, from, to}`. The renderer keeps a per-part cursor into its segment list and interpolates on its own clock (`positionAt`, amortized O(1); it is a cache, not state, so seeking or looping backwards stays correct). Speed changes and animation off then never touch results.
5. **Do not add GPU picking, post-processing or shadows without re-measuring.** Shadows and effects multiply the triangle cost, and the spike measured none of them.
6. **Next risk to retire:** draw-call and triangle budgets on a low-end laptop (UHD 620 class) and in Firefox and Safari. Run the command below there.

ADR-0002 and ADR-0008 need no change in direction. Suggested edits for the lead: record the instancing + LOD recommendation and the budgets above as an ADR-0002 consequence, replace "PL-5 must confirm" with the measured result, and remove the "revisit if PL-5 shows problems" clause.

## Reproduce

```bash
pnpm install && pnpm --filter @factory-sim/spike-pl-5-rendering dev   # terminal 1, serves :5173
cd spikes/pl-5-rendering && node scripts/measure.mjs "http://localhost:5173/?auto=1"                 # terminal 2: markdown table
```

For an interactive view open `http://localhost:5173/`. Append `&x=10` to the measure URL for headroom runs. Set `CHROME=/path/to/chrome` if `chromium` is not on the PATH. CI has no GPU, so there is no fps gate. The non-rendering logic is covered by `pnpm --filter @factory-sim/spike-pl-5-rendering test`.
