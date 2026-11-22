# ADR-0007: Custom discrete-event engine in TypeScript

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

Simulation must run in the browser for animation and on the server for fast batch runs, with identical results.

## Decision

Own DES engine in packages/sim-engine: event calendar, entities, resources, queues; seeded PRNG; no DOM or Node dependencies. Runs in a Web Worker in the browser and in worker threads on the server.

## Consequences

- Positive: Deterministic, same results everywhere, full control over mixed-model and labor logic.
- Negative: We own correctness: validated against M/M/1 theory and the reference model.

## Alternatives considered

SimPy (Python, cannot run in the browser); commercial engines (licensing, not embeddable).
