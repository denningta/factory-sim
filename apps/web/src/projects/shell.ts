import type { Project } from '@factory-sim/schema';
import { findIssues } from '../layout/overlaps';
import { missingCycleTimes } from '../products/cycleTimes';
import { unstaffedManualStations } from '../products/preRunIssues';

export type Screen = 'layout' | 'products' | 'simulate' | 'results';
const SCREENS: readonly Screen[] = ['layout', 'products', 'simulate', 'results'];

/** `#/p/<id>` opens Layout (the format before tabs existed); `#/p/<id>/<tab>` opens that tab. */
export function parseHash(hash: string): { id: string; screen: Screen } | null {
  const m = /^#\/p\/([\w-]+)(?:\/([\w-]+))?$/.exec(hash);
  if (!m) return null;
  const screen = SCREENS.find((s) => s === m[2]) ?? 'layout';
  return { id: m[1]!, screen };
}

export function formatHash(id: string, screen: Screen): string {
  return screen === 'layout' ? `#/p/${id}` : `#/p/${id}/${screen}`;
}

/**
 * Open problems per screen; 0 means no badge. Layout uses the same staffing rule as the
 * pre-run check so the badge and the model check agree.
 */
export function screenBadges(
  p: Pick<Project, 'equipment' | 'products' | 'cycleTimes' | 'technicians'>,
): { layout: number; products: number } {
  return {
    layout: findIssues(p.equipment, null).overlaps.length + unstaffedManualStations(p).length,
    products: p.products.length === 0 ? 1 : missingCycleTimes(p).length,
  };
}
