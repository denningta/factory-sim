# ADR-0002: Frontend: React + React Three Fiber

- **Status:** Accepted (signed off 2026-11-21; performance confirmed by the PL-5 spike on UHD 630 / Chromium, weaker-machine rerun pending; see ADR-0014)
- **Date:** 2026-11-21

## Context

The editor mixes heavy 3D (three.js) with many forms, tables and panels.

## Decision

React + Vite for the app, React Three Fiber + drei for the three.js scene, Zustand for editor state.

## Consequences

- Positive: Declarative 3D that shares state with the UI; large ecosystem; agents write React well.
- Negative: React re-renders must be kept out of the render loop; rendering approach (instancing, LOD, budgets) is set in ADR-0014.

## Alternatives considered

Vanilla three.js + a light UI framework (faster, more code); Svelte + Threlte (smaller ecosystem).
