import type { Project } from '@factory-sim/schema';

export type Screen = 'layout' | 'products' | 'simulate' | 'results';

export function parseHash(_hash: string): { id: string; screen: Screen } | null {
  throw new Error('not implemented');
}

export function formatHash(_id: string, _screen: Screen): string {
  throw new Error('not implemented');
}

/** Open problems per screen; 0 means no badge. */
export function screenBadges(
  _p: Pick<Project, 'equipment' | 'products' | 'cycleTimes' | 'technicians'>,
): { layout: number; products: number } {
  throw new Error('not implemented');
}
