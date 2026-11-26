import type { TechPose } from './techTracks';

/** Swing angles (radians about the x axis, positive = forward) of each limb. */
export interface LimbAngles {
  armL: number;
  armR: number;
  legL: number;
  legR: number;
}

export function limbAngles(_pose: Pick<TechPose, 'state' | 'walked'>): LimbAngles {
  throw new Error('not implemented');
}

/** Triangles in one figure (all parts), for the ADR-0014 budget. */
export function figureTriangleCount(): number {
  throw new Error('not implemented');
}
