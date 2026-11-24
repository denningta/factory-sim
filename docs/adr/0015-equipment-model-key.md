# ADR-0015: Equipment names its 3D model with an optional `model` key

- **Status:** Accepted (product owner, 2026-11-23, sprint 8 planning)
- **Date:** 2026-11-23
- **Amends:** ADR-0010 (the "appearance" part of a type), ADR-0014 (models are chosen per type, not only per behavior)

## Context

The renderer derives every model from the base behavior (`apps/web/src/equipment/shapes.ts`). A custom type such as "5-axis CNC" (EQ-3) therefore looks like every other workstation, and a curing oven looks the same as a hand bench. Sprint 8 (UI-7, UI-8) introduces a registry of 3D models in `apps/web`. Users need a way to say which one a type uses, and adding a model must not require a schema change each time.

## Decision

1. Equipment types and placed instances have an optional `model: string`: a kebab-case id up to 64 characters (`modelIdSchema` in `packages/schema`). It is a type setting like footprint and color, so `instantiate` and "update instances" copy it.
2. **The schema does not list the models.** Which ids exist is decided by the model registry in `apps/web`. An absent key, or an id the renderer doesn't know (for example a model removed in a later version), falls back to the behavior's default model. A project never fails to load because of its `model` value.
3. **Appearance only.** The engine ignores `model`; behavior and params still decide how the equipment simulates. Models may still vary by params (e.g. manual vs automatic workstation) when no `model` is set.
4. Project schema **v7**. The key is optional, so the v6 → v7 step only sets the version. User library types are stored as JSONB documents validated by the same schema, so no DB migration is needed.

## Consequences

- Positive: a user type can look like what it is. New models are added in `apps/web` alone. Old projects load unchanged.
- Negative: a typo in an id fails silently to the default model, so the web app must offer only registry ids (a picker, not free text). The renderer groups instances for instancing by model as well as type and size (EQ-5 / UI-7).
- Mesh data stays out of the schema. User-uploaded GLB models would be a separate decision.

## Alternatives considered

- An enum of model ids in the schema: catches typos, but every new model needs a schema version and lead work.
- Deriving the model from the type name: fragile and not user-controllable.
- Storing mesh primitives in the type: makes the schema a geometry format and breaks ADR-0014's per-type instancing.
