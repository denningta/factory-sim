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

const REST = 1;
const HOVER = 1.5;
const DOT = 0.35;
const DIM = 0.35;

export function portVisual(i: PortVisualInput): PortVisual {
  const connecting = i.pending !== null;
  const hint = i.hovered ? (i.kind === 'output' ? 'Output: click to connect' : 'Input') : null;
  // Connect mode: valid targets (and the pending output) stand out, everything else recedes.
  if (connecting) {
    const lit = i.active || i.valid;
    return {
      scale: i.hovered ? HOVER : lit ? HOVER : REST,
      opacity: lit ? 1 : DIM,
      showLabel: true,
      hint,
    };
  }
  if (i.hovered) return { scale: HOVER, opacity: 1, showLabel: true, hint };
  // A connected port is a quiet dot until the user needs it again.
  if (i.connected) return { scale: DOT, opacity: 0.5, showLabel: false, hint };
  return { scale: REST, opacity: 0.85, showLabel: true, hint };
}

/** Input ports the pending output could connect to (other equipment, not already linked). */
export function validInputKeys(
  equipment: readonly Equipment[],
  connections: readonly Connection[],
  pending: PortRef | null,
): Set<string> {
  const keys = new Set<string>();
  if (!pending) return keys;
  const linked = new Set(
    connections.filter((c) => portKey(c.from) === portKey(pending)).map((c) => portKey(c.to)),
  );
  for (const e of equipment) {
    if (e.id === pending.equipmentId) continue;
    for (const p of e.ports) {
      const k = portKey({ equipmentId: e.id, portId: p.id });
      if (p.kind === 'input' && !linked.has(k)) keys.add(k);
    }
  }
  return keys;
}

export const portKey = (r: PortRef) => `${r.equipmentId}:${r.portId}`;
