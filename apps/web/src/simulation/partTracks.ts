import type { Connection, Equipment } from '@factory-sim/schema';
import type { LineEvent } from '@factory-sim/sim-engine';

export interface Pt {
  x: number;
  z: number;
}

/** Where parts sit and travel, in plan meters (x, z = floor x, y). */
export interface LineGeometry {
  connections: ReadonlyMap<string, { from: Pt; to: Pt }>;
  equipment: ReadonlyMap<string, { center: Pt; queueOrigin: Pt; queueDir: Pt; path: [Pt, Pt] }>;
}

export interface PartPose {
  partId: number;
  x: number;
  z: number;
  color: string;
  state: 'moving' | 'queued' | 'processing';
}

export interface PartTracks {
  ingest(events: readonly LineEvent[]): void;
  at(t: number): PartPose[];
  clear(): void;
}

export function buildLineGeometry(
  _equipment: readonly Equipment[],
  _connections: readonly Connection[],
): LineGeometry {
  throw new Error('not implemented');
}

export function createPartTracks(
  _geometry: LineGeometry,
  _colors: ReadonlyMap<string, string>,
): PartTracks {
  throw new Error('not implemented');
}
