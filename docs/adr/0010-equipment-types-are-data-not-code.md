# ADR-0010: Equipment types are data, not code

- **Status:** Accepted (signed off 2026-11-21)
- **Date:** 2026-11-21

## Context

Users must add new equipment (e.g., 5-axis CNC) without a developer.

## Decision

An equipment type = base behavior (workstation, buffer, conveyor, source, sink) + parameters + footprint + height + input/output points + appearance, stored in a library table. Instances copy their type's settings.

## Consequences

- Positive: Extensible by users; engine stays small with five behaviors.
- Negative: New behaviors (e.g., AGV) still need code; type changes must offer to update instances.

## Alternatives considered

A class per equipment type (developer needed for every new machine).
