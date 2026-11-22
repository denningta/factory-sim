# ADR-0002: Frontend: React + React Three Fiber

- **Status:** Accepted (signed off 2026-11-21; revisit if the PL-5 spike shows performance problems)
- **Date:** 2026-11-21

## Context

The editor mixes heavy 3D (three.js) with many forms, tables and panels.

## Decision

React + Vite for the app, React Three Fiber + drei for the three.js scene, Zustand for editor state.

## Consequences

- Positive: Declarative 3D that shares state with the UI; large ecosystem; agents write React well.
- Negative: React re-renders must be kept out of the render loop; PL-5 must confirm performance with instancing.

## Alternatives considered

Vanilla three.js + a light UI framework (faster, more code); Svelte + Threlte (smaller ecosystem).
