import type { Connection, Equipment, PortRef } from '@factory-sim/schema';

export type PortKind = 'input' | 'output';

export interface PortVisualInput {
  kind: PortKind;
  connected: boolean;
  hovered: boolean;
  /** The output the user is connecting from, if any. */
  pending: PortRef | null;
  /** This port is the pending output. */
  active: boolean;
  /** This port is a valid target for the pending output. */
  valid: boolean;
}

export interface PortVisual {
  /** Multiplier on the marker's base size. */
  scale: number;
  opacity: number;
  /** The IN / OUT label is drawn only while the marker is big enough to read. */
  showLabel: boolean;
  hint: string | null;
}

export function portVisual(_i: PortVisualInput): PortVisual {
  throw new Error('not implemented');
}

/** Input ports the pending output could connect to (other equipment, not already linked). */
export function validInputKeys(
  _equipment: readonly Equipment[],
  _connections: readonly Connection[],
  _pending: PortRef | null,
): Set<string> {
  throw new Error('not implemented');
}

export const portKey = (r: PortRef) => `${r.equipmentId}:${r.portId}`;
