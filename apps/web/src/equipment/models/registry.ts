import type { Equipment, EquipmentBehavior } from '@factory-sim/schema';
import { bench } from './bench';
import { bufferRack } from './buffer-rack';
import { conveyorBelt } from './conveyor-belt';
import { machine } from './machine';
import { sinkContainer } from './sink-container';
import { sourceHopper } from './source-hopper';
import type { ModelDefinition } from './types';
import { workstationCell } from './workstation-cell';

/** Every model the app can draw. Add a model here (see README.md). */
export const MODELS: readonly ModelDefinition[] = [
  bench,
  machine,
  workstationCell,
  bufferRack,
  conveyorBelt,
  sourceHopper,
  sinkContainer,
];

/** What each behavior looks like when its `model` is absent or unusable (ADR-0015). */
const DEFAULTS: Record<EquipmentBehavior, ModelDefinition> = {
  workstation: bench,
  buffer: bufferRack,
  conveyor: conveyorBelt,
  source: sourceHopper,
  sink: sinkContainer,
};

/** A workstation run automatically (a tech only loads and unloads) looks like a machine. */
function isAutomatic(params: object | undefined): boolean {
  const labor = (params as { labor?: { mode?: unknown } } | undefined)?.labor;
  return labor?.mode === 'automatic';
}

export function defaultModelFor(behavior: EquipmentBehavior, params?: object): ModelDefinition {
  return behavior === 'workstation' && isAutomatic(params) ? machine : DEFAULTS[behavior];
}

/** Models the picker may offer for a behavior, in registry order. */
export function modelsFor(behavior: EquipmentBehavior): ModelDefinition[] {
  return MODELS.filter((m) => m.behaviors.includes(behavior));
}

/**
 * The model to draw: the equipment's own `model` if the registry has it and it suits the
 * behavior, otherwise the behavior's default. Never fails, so a stale id can't break a project.
 */
export function resolveModel(
  equipment: Pick<Equipment, 'behavior' | 'model'> & { params?: object },
  registry: readonly ModelDefinition[] = MODELS,
): ModelDefinition {
  const { behavior, model, params } = equipment;
  const found = model === undefined ? undefined : registry.find((m) => m.id === model);
  return found && found.behaviors.includes(behavior) ? found : defaultModelFor(behavior, params);
}

/** Builds the equipment's resolved model at its own size and params. */
/** What building a model needs: a type, an instance, or a draft in the type editor. */
export type ModelSource = Pick<Equipment, 'behavior' | 'model' | 'footprint' | 'height'> & {
  params: object;
};

export function buildModel(e: ModelSource) {
  const model = resolveModel(e);
  const size = { width: e.footprint.width, length: e.footprint.length, height: e.height };
  return { model, ...model.build(size, e.params as Readonly<Record<string, unknown>>) };
}
