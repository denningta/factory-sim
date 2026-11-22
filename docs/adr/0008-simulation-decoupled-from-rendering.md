# ADR-0008: Simulation decoupled from rendering

- **Status:** Accepted (signed off 2026-11-21; confirmed by the PL-5 spike on UHD 630 / Chromium, weaker-machine rerun pending; see ADR-0014 for the segment-track design)
- **Date:** 2026-11-21

## Context

The sim runs up to 1000x real time; the 3D view runs at ~60 fps.

## Decision

The engine emits state-change events with sim timestamps; the renderer keeps its own clock and interpolates part and tech positions. Animation can be turned off without changing results.

## Consequences

- Positive: Speed changes and headless runs never affect results; the UI thread stays responsive.
- Negative: Needs a compact event stream and interpolation code in the renderer.

## Alternatives considered

Sim driven by the render loop (results would depend on frame rate).
