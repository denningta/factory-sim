import type { EquipmentBehavior } from '@factory-sim/schema';

/** One line per behavior for the library; UI copy, so it lives here and not in the schema. */
export const TYPE_DESCRIPTIONS: Record<EquipmentBehavior, string> = {
  workstation: 'Processes parts, one cycle at a time',
  buffer: 'Holds WIP between steps',
  conveyor: 'Moves parts at a set speed',
  source: 'Releases raw material into the line',
  sink: 'Ships finished parts out of the line',
};
