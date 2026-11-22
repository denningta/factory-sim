import type { Equipment } from '@factory-sim/schema';

/** Ids of equipment whose center lies inside the rectangle spanned by corners a and b. */
export function idsInRect(
  equipment: readonly Equipment[],
  a: { x: number; y: number },
  b: { x: number; y: number },
): string[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return equipment
    .filter(
      (e) => e.position.x >= x0 && e.position.x <= x1 && e.position.y >= y0 && e.position.y <= y1,
    )
    .map((e) => e.id);
}

type Point = { x: number; y: number };

/**
 * Where a dragged selection lands: `delta` is relative to `starts`; the anchor snaps to the
 * grid and the others keep their offset from it. Shared by the live preview and the commit.
 */
export function dragTargets(
  starts: Record<string, Point>,
  anchorId: string,
  delta: Point,
  snap: { spacing: number; enabled: boolean },
): Record<string, Point> {
  const anchor = starts[anchorId];
  if (!anchor) return {};
  const raw = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const p = snap.enabled
    ? {
        x: Math.round(raw.x / snap.spacing) * snap.spacing,
        y: Math.round(raw.y / snap.spacing) * snap.spacing,
      }
    : raw;
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const out: Record<string, Point> = {};
  for (const [id, s] of Object.entries(starts)) out[id] = { x: s.x + dx, y: s.y + dy };
  return out;
}
