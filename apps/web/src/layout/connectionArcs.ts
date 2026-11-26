import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** How far the arc clears the taller of its two stations (m). */
export const ARC_CLEARANCE = 0.5;
const SEGMENTS = 24;
const RADIUS = 0.08;
const HEAD_RADIUS = 0.24;
const HEAD_LENGTH = 0.5;
/** Dash pattern length along the arc (m); the flow texture repeats once per period. */
export const ARC_PERIOD = 0.9;

export type ArcInput = {
  id: string;
  /** Output and input port points in world metres (x, height, z). */
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  /** Height the arc peaks at. */
  top: number;
};
/** The vertices of one connection within the merged geometry. */
export type ArcRange = { id: string; start: number; count: number };

function curveOf(a: ArcInput) {
  // Control points straight above each port make the arc leave and enter vertically; the control
  // height is solved so the curve's midpoint (its peak, for level ports) lands on `top`.
  const c = (8 * a.top - a.from.y - a.to.y) / 6;
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(a.from.x, a.from.y, a.from.z),
    new THREE.Vector3(a.from.x, c, a.from.z),
    new THREE.Vector3(a.to.x, c, a.to.z),
    new THREE.Vector3(a.to.x, a.to.y, a.to.z),
  );
}

/** Points along the arc from the output port to the input port. */
export const arcPath = (a: ArcInput): THREE.Vector3[] => curveOf(a).getPoints(SEGMENTS);

function oneArc(a: ArcInput): THREE.BufferGeometry {
  const curve = curveOf(a);
  const tube = new THREE.TubeGeometry(curve, SEGMENTS, RADIUS, 6, false);
  // u = metres along the arc / period, so the dash pattern has the same size on every arc.
  const uv = tube.getAttribute('uv');
  const k = curve.getLength() / ARC_PERIOD;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  // Direction marker: a cone whose tip touches the input port, pointing along the end tangent.
  const head = new THREE.ConeGeometry(HEAD_RADIUS, HEAD_LENGTH, 10).translate(
    0,
    -HEAD_LENGTH / 2,
    0,
  );
  head.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      curve.getTangent(1).normalize(),
    ),
  );
  head.translate(a.to.x, a.to.y, a.to.z);
  const huv = head.getAttribute('uv');
  for (let i = 0; i < huv.count; i++) huv.setX(i, 0); // dash alpha is 0 at u = 0: no flow on the head
  // Normals are unused by the basic material; the two parts must carry the same attributes.
  tube.deleteAttribute('normal');
  head.deleteAttribute('normal');
  return mergeGeometries([tube, head])!;
}

/** All arcs as ONE geometry, so the draw calls stay constant however many connections there are. */
export function buildArcs(arcs: readonly ArcInput[]): {
  geometry: THREE.BufferGeometry;
  ranges: ArcRange[];
} {
  if (arcs.length === 0) return { geometry: new THREE.BufferGeometry(), ranges: [] };
  const parts = arcs.map(oneArc);
  const ranges: ArcRange[] = [];
  let start = 0;
  parts.forEach((p, i) => {
    const count = p.getAttribute('position').count;
    ranges.push({ id: arcs[i]!.id, start, count });
    start += count;
  });
  const geometry = mergeGeometries(parts)!;
  // RGBA per vertex: rgb is the connection's colour, a is 1 while the flow dashes should show.
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(start * 4), 4));
  for (const p of parts) p.dispose();
  return { geometry, ranges };
}

/** The connection a picked vertex belongs to. */
export function connectionAtVertex(ranges: readonly ArcRange[], vertex: number): string | null {
  const r = ranges.find((q) => vertex >= q.start && vertex < q.start + q.count);
  return r ? r.id : null;
}

const scratch = new THREE.Color();
/** Writes each connection's colour and flow flag; returns whether anything changed. */
export function paintArcs(
  geometry: THREE.BufferGeometry,
  ranges: readonly ArcRange[],
  looks: ReadonlyMap<string, { color: string; flowing: boolean }>,
): boolean {
  const attr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!attr) return false;
  let changed = false;
  for (const r of ranges) {
    const look = looks.get(r.id);
    if (!look) continue;
    scratch.set(look.color);
    const a = look.flowing ? 1 : 0;
    if (
      Math.abs(attr.getX(r.start) - scratch.r) < 1e-6 &&
      Math.abs(attr.getY(r.start) - scratch.g) < 1e-6 &&
      Math.abs(attr.getZ(r.start) - scratch.b) < 1e-6 &&
      attr.getW(r.start) === a
    )
      continue;
    for (let i = r.start; i < r.start + r.count; i++)
      attr.setXYZW(i, scratch.r, scratch.g, scratch.b, a);
    changed = true;
  }
  if (changed) attr.needsUpdate = true;
  return changed;
}
