# ADR-0009: Mixed-model data model

- **Status:** Accepted (decided 2026-11-21)
- **Date:** 2026-11-21

## Context

Many end items share the same stations and cells, each with its own path and work content.

## Decision

Product -> Routing (ordered steps, each pointing to a station). Cycle time keyed by (product, station). Demand mix and release rule at the project level. Parts carry their product ID; routing at splits follows the part's next step.

## Consequences

- Positive: Mixed-model from day one without special cases later.
- Negative: More complex input UI (product x station grid) and validation.

## Alternatives considered

Single-product model extended later (would touch every module).
