import type { LineEvent } from '@factory-sim/sim-engine';
import type { LineGeometry } from './partTracks';

export interface TechPose {
  techId: string;
  name: string;
  x: number;
  z: number;
  state: 'walking' | 'standing';
}

export interface TechTracks {
  /** Appends engine events (time order). */
  ingest(events: readonly LineEvent[]): void;
  /** Where every tech is at sim time `t`. */
  at(t: number): TechPose[];
}

export interface TechInfo {
  id: string;
  name: string;
  /** Station the tech starts at (the first one it is assigned to). */
  homeId: string | undefined;
}

export function createTechTracks(_geometry: LineGeometry, _techs: readonly TechInfo[]): TechTracks {
  throw new Error('not implemented');
}
