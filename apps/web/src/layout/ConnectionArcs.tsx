import type { Connection, Equipment } from '@factory-sim/schema';
import type { RunSession } from '../simulation/runSession';
export const arcLook = (_id: string): { color: string; flowing: boolean } | undefined => {
  throw new Error('not implemented');
};
export function ConnectionArcs(_p: {
  equipment: readonly Equipment[];
  connections: readonly Connection[];
  session?: RunSession;
  selectedId?: string | null;
}) {
  return null;
}
