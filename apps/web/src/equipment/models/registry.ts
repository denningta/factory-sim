import type { Equipment, EquipmentBehavior } from '@factory-sim/schema';
import type { ModelDefinition } from './types';

export const MODELS: readonly ModelDefinition[] = [];

export function defaultModelFor(_behavior: EquipmentBehavior): ModelDefinition {
  throw new Error('not implemented');
}

export function modelsFor(_behavior: EquipmentBehavior): ModelDefinition[] {
  throw new Error('not implemented');
}

export function resolveModel(
  _equipment: Pick<Equipment, 'behavior' | 'model'>,
  _registry: readonly ModelDefinition[] = MODELS,
): ModelDefinition {
  throw new Error('not implemented');
}
