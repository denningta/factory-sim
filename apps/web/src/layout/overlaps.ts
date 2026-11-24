import type { Equipment } from '@factory-sim/schema';

export interface LayoutIssues {
  /** Pairs whose footprints overlap. */
  overlaps: [string, string][];
  /** Pairs that don't overlap but sit closer than the clearance. */
  tooClose: [string, string][];
  /** Every equipment id involved in an overlap. */
  overlappingIds: Set<string>;
  /** Every equipment id involved in a clearance violation. */
  tooCloseIds: Set<string>;
  /** Flagged pairs: one issue per pair, however it is flagged. */
  count: number;
}

type P = { x: number; y: number };

/** Items that merely touch (or differ by float noise) are not overlapping. */
const EPS = 1e-9;

function corners(e: Equipment): P[] {
  const c = Math.cos(e.rotation);
  const s = Math.sin(e.rotation);
  const hw = e.footprint.width / 2;
  const hl = e.footprint.length / 2;
  return [
    [-hw, -hl],
    [hw, -hl],
    [hw, hl],
    [-hw, hl],
  ].map(([u, v]) => ({
    x: e.position.x + u! * c - v! * s,
    y: e.position.y + u! * s + v! * c,
  }));
}

function project(poly: P[], axis: P): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of poly) {
    const d = p.x * axis.x + p.y * axis.y;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  return [lo, hi];
}

/** Separating-axis test; rectangles have two unique edge normals each. */
function overlap(a: P[], b: P[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const p = poly[i]!;
      const q = poly[i + 1]!;
      const axis = { x: -(q.y - p.y), y: q.x - p.x };
      const [a0, a1] = project(a, axis);
      const [b0, b1] = project(b, axis);
      const len = Math.hypot(axis.x, axis.y);
      if (a1 - b0 <= EPS * len || b1 - a0 <= EPS * len) return false;
    }
  }
  return true;
}

function pointSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Gap between two non-overlapping rectangles: the closest vertex-to-edge distance. */
function gap(a: P[], b: P[]): number {
  let best = Infinity;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const)
    for (const p of from)
      for (let i = 0; i < 4; i++) best = Math.min(best, pointSegment(p, to[i]!, to[(i + 1) % 4]!));
  return best;
}

/** Layout problems: overlapping footprints and, when `clearance` (m) is set, too-close pairs. */
export function findIssues(
  equipment: readonly Equipment[],
  clearance: number | null,
): LayoutIssues {
  const polys = equipment.map(corners);
  const radius = equipment.map((e) => Math.hypot(e.footprint.width, e.footprint.length) / 2);
  const out: LayoutIssues = {
    overlaps: [],
    tooClose: [],
    overlappingIds: new Set(),
    tooCloseIds: new Set(),
    count: 0,
  };
  for (let i = 0; i < equipment.length; i++) {
    for (let j = i + 1; j < equipment.length; j++) {
      const a = equipment[i]!;
      const b = equipment[j]!;
      const dist = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
      // Cheap reject: circles around the footprints are farther apart than the clearance.
      if (dist > radius[i]! + radius[j]! + (clearance ?? 0)) continue;
      if (overlap(polys[i]!, polys[j]!)) {
        out.overlaps.push([a.id, b.id]);
        out.overlappingIds.add(a.id).add(b.id);
      } else if (clearance !== null && gap(polys[i]!, polys[j]!) < clearance - EPS) {
        out.tooClose.push([a.id, b.id]);
        out.tooCloseIds.add(a.id).add(b.id);
      }
    }
  }
  out.count = out.overlaps.length + out.tooClose.length;
  return out;
}
