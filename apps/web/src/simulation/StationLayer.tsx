import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Equipment } from '@factory-sim/schema';
import { buildModel } from '../equipment/models/registry';
import { CureRig } from './CureRig';
import { StationCallouts } from './StationCallouts';
import type { RunSession } from './runSession';
import {
  LIGHT_ORDER,
  SEGMENT_OF,
  findBottleneck,
  lightSegments,
  noStateColor,
} from './stationStatus';
import type { LightSegment } from './stationStatus';
import { stationUtilization } from './utilization';
import { getTheme, useTheme } from '../ui/themeStore';

/** The flag is a text figure like the KPIs: a few updates a second, not per frame. */
const FLAG_INTERVAL_MS = 200;
/** Floor outline: lifted a hair so it never z-fights the floor. */
const OUTLINE_Y = 0.03;
const OUTLINE_WIDTH = 0.14;
const HALO_WIDTH = 0.7;
const SEGMENT_H = 0.16;
const SEGMENT_R = 0.13;

type LightColors = Record<LightSegment, THREE.Color>;
interface Mounted {
  lights: LightColors;
  outline: THREE.Color;
  /** Shared by every halo (only the bottleneck draws one). */
  halo: THREE.MeshBasicMaterial;
  /** Whether the halo mesh is currently rendered (the station is the bottleneck). */
  flagged: boolean;
}
const registry = new Map<string, Mounted>();
/** Test hook: the stack-light colours of a mounted station, by segment. */
export const lightMaterials = (
  stationId: string,
): { [S in LightSegment]: { color: THREE.Color } } | undefined => {
  const lights = registry.get(stationId)?.lights;
  return lights && (Object.fromEntries(LIGHT_ORDER.map((s) => [s, { color: lights[s] }])) as never);
};
/** Test hook: outline colour and halo material, and whether the halo is drawn. */
export const markerMaterials = (stationId: string) => {
  const m = registry.get(stationId);
  return m && { outline: { color: m.outline }, halo: m.halo, flagged: m.flagged };
};

/**
 * Each workstation gets a stack light, a floor outline in its state colour and, if it is the
 * bottleneck, an accent halo; the callout cards sit above. Every station shares a few meshes
 * (one instanced mesh per light segment, one merged outline mesh, one halo), so the draw calls
 * don't grow with the station count (ADR-0014). Colours are written into instance and vertex
 * colours from the sim clock's latest event; only the bottleneck flag, which moves rarely, goes
 * through React state (and bails out while it doesn't change).
 */
export function StationLayer({
  session,
  stations,
}: {
  session: RunSession;
  stations: readonly Equipment[];
}) {
  const bottleneck = useBottleneck(session, stations);
  return (
    <>
      <StationMarkers session={session} stations={stations} flaggedId={bottleneck} />
      {stations.map((e) => (
        <CureRig key={e.id} session={session} station={e} />
      ))}
      <StationCallouts session={session} stations={stations} bottleneckId={bottleneck} />
    </>
  );
}

function useBottleneck(session: RunSession, stations: readonly Equipment[]) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setId(findBottleneck(stationUtilization(session.stats(), [...stations])));
    read();
    const timer = setInterval(() => session.playing && read(), FLAG_INTERVAL_MS);
    const unsub = session.subscribe(read);
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, [session, stations]);
  return id;
}

/** A flat rectangular frame of the given border width around a w × l rectangle (plan x, z). */
function frameGeometry(w: number, l: number, border: number) {
  const rect = (hw: number, hl: number) => {
    const p = new THREE.Path();
    p.moveTo(-hw, -hl).lineTo(hw, -hl).lineTo(hw, hl).lineTo(-hw, hl).closePath();
    return p;
  };
  const shape = new THREE.Shape(rect(w / 2 + border, l / 2 + border).getPoints());
  shape.holes.push(rect(w / 2, l / 2));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Where a station's stack light sits in the model, falling back to the top centre. */
function lightAnchor(station: Equipment): [number, number, number] {
  return buildModel(station).anchors.statusLight ?? [0, station.height, 0];
}

/** Local → world placement of a station: plan position, turned by its rotation (plan x→y is -y in three). */
function placement(station: Equipment, local: THREE.Vector3): THREE.Vector3 {
  return local
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -station.rotation)
    .add(new THREE.Vector3(station.position.x, 0, station.position.y));
}

/** All stations' outline frames as one geometry with a per-vertex colour; ranges[i] = its vertices. */
function mergedOutlines(stations: readonly Equipment[]) {
  const positions: number[] = [];
  const indices: number[] = [];
  const ranges: { start: number; count: number }[] = [];
  for (const st of stations) {
    const g = frameGeometry(st.footprint.width, st.footprint.length, OUTLINE_WIDTH);
    const pos = g.getAttribute('position');
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      const p = placement(st, new THREE.Vector3(pos.getX(i), OUTLINE_Y, pos.getZ(i)));
      positions.push(p.x, OUTLINE_Y, p.z);
    }
    for (const i of g.getIndex()?.array ?? []) indices.push(base + i);
    ranges.push({ start: base, count: pos.count });
    g.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3),
  );
  geometry.setIndex(indices);
  return { geometry, ranges };
}

function StationMarkers({
  session,
  stations,
  flaggedId,
}: {
  session: RunSession;
  stations: readonly Equipment[];
  flaggedId: string | null;
}) {
  const theme = useTheme();
  const n = stations.length;
  const colors = useMemo(
    () =>
      stations.map(() => ({
        lights: Object.fromEntries(
          LIGHT_ORDER.map((s) => [s, new THREE.Color(noStateColor())]),
        ) as LightColors,
        outline: new THREE.Color(noStateColor()),
      })),
    [stations],
  );
  const halo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: theme.color.accent,
        transparent: true,
        // Normal blending: additive washes out on the light floor.
        opacity: 0.4,
        depthWrite: false,
      }),
    [theme.color.accent],
  );
  const outlines = useMemo(() => mergedOutlines(stations), [stations]);
  const lightMeshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const outlineMesh = useRef<THREE.Mesh>(null);
  useEffect(() => () => halo.dispose(), [halo]);
  useEffect(() => () => outlines.geometry.dispose(), [outlines]);
  useEffect(() => {
    stations.forEach((st, i) => registry.set(st.id, { ...colors[i]!, halo, flagged: false }));
    return () => stations.forEach((st) => registry.delete(st.id));
  }, [stations, colors, halo]);
  useEffect(() => {
    for (const st of stations) {
      const entry = registry.get(st.id);
      if (entry) entry.flagged = st.id === flaggedId;
    }
  }, [stations, flaggedId]);

  // Light segments never move: write their matrices once per layout.
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    LIGHT_ORDER.forEach((_, seg) => {
      const mesh = lightMeshes.current[seg];
      if (!(mesh instanceof THREE.InstancedMesh)) return; // unit tests render DOM stand-ins
      stations.forEach((st, i) => {
        const a = lightAnchor(st);
        const p = placement(st, new THREE.Vector3(a[0], a[1] + SEGMENT_H * (seg + 0.5), a[2]));
        mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [stations]);

  // Written in the frame the event is applied; nothing here touches React state.
  useFrame(() => {
    const t = getTheme();
    const states = session.stationStates();
    stations.forEach((st, i) => {
      const state = states.get(st.id);
      const c = colors[i]!;
      for (const s of lightSegments(state, t))
        c.lights[s.segment].set(s.lit ? s.color : t.scene.parts.dark);
      c.outline.set(state ? t.state[SEGMENT_OF[state]].strong : noStateColor(t));
      LIGHT_ORDER.forEach((seg, k) => {
        const mesh = lightMeshes.current[k];
        if (mesh instanceof THREE.InstancedMesh) mesh.setColorAt(i, c.lights[seg]);
      });
      const attr = outlines.geometry.getAttribute('color') as THREE.BufferAttribute;
      const { start, count } = outlines.ranges[i]!;
      for (let v = start; v < start + count; v++)
        attr.setXYZ(v, c.outline.r, c.outline.g, c.outline.b);
    });
    for (const mesh of lightMeshes.current)
      if (mesh instanceof THREE.InstancedMesh && mesh.instanceColor)
        mesh.instanceColor.needsUpdate = true;
    (outlines.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  });

  const flagged = stations.find((e) => e.id === flaggedId);
  const haloGeometry = useMemo(
    () =>
      flagged
        ? frameGeometry(
            flagged.footprint.width + OUTLINE_WIDTH * 2,
            flagged.footprint.length + OUTLINE_WIDTH * 2,
            HALO_WIDTH,
          )
        : null,
    [flagged],
  );
  useEffect(() => () => haloGeometry?.dispose(), [haloGeometry]);

  return (
    <>
      {LIGHT_ORDER.map((s, i) => (
        <instancedMesh
          key={`${s}:${n}`}
          ref={(m: THREE.InstancedMesh | null) => {
            lightMeshes.current[i] = m;
          }}
          args={[undefined, undefined, n]}
          frustumCulled={false}
        >
          <cylinderGeometry args={[SEGMENT_R, SEGMENT_R, SEGMENT_H * 0.92, 16]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      ))}
      <mesh ref={outlineMesh} geometry={outlines.geometry} frustumCulled={false}>
        <meshBasicMaterial vertexColors />
      </mesh>
      {flagged && haloGeometry && (
        <mesh
          position={[flagged.position.x, OUTLINE_Y / 2, flagged.position.y]}
          rotation={[0, -flagged.rotation, 0]}
          material={halo}
          geometry={haloGeometry}
        />
      )}
    </>
  );
}
