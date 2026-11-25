import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Equipment } from '@factory-sim/schema';
import { buildModel } from '../equipment/models/registry';
import { StationCallouts } from './StationCallouts';
import type { RunSession } from './runSession';
import { LIGHT_ORDER, findBottleneck, lightSegments, noStateColor } from './stationStatus';
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

type LightMaterials = Record<LightSegment, THREE.MeshStandardMaterial>;
const registry = new Map<string, LightMaterials>();
/** Test hook: the stack-light materials of a mounted station, by segment. */
export const lightMaterials = (stationId: string): LightMaterials | undefined =>
  registry.get(stationId);

/**
 * Each workstation gets a stack light, a floor outline in its state colour and, if it is the
 * bottleneck, an accent halo; the callout cards sit above. Colours are written through refs
 * from the sim clock's latest event; only the bottleneck flag, which moves rarely, goes
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
      {stations.map((e) => (
        <StationMarker key={e.id} session={session} station={e} flagged={e.id === bottleneck} />
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

function StationMarker({
  session,
  station,
  flagged,
}: {
  session: RunSession;
  station: Equipment;
  flagged: boolean;
}) {
  const { width, length } = station.footprint;
  const theme = useTheme();
  const light = useMemo(() => {
    const anchor = buildModel(station).anchors.statusLight;
    return anchor ?? ([0, station.height, 0] as [number, number, number]);
  }, [station]);
  const materials = useMemo(() => {
    const make = () => new THREE.MeshStandardMaterial({ color: noStateColor() });
    return Object.fromEntries(LIGHT_ORDER.map((s) => [s, make()])) as LightMaterials;
  }, []);
  const outline = useMemo(() => new THREE.MeshBasicMaterial({ color: noStateColor() }), []);
  const halo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: theme.color.accent,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [theme.color.accent],
  );
  const outlineGeometry = useMemo(
    () => frameGeometry(width, length, OUTLINE_WIDTH),
    [width, length],
  );
  const haloGeometry = useMemo(
    () => frameGeometry(width + OUTLINE_WIDTH * 2, length + OUTLINE_WIDTH * 2, HALO_WIDTH),
    [width, length],
  );
  useEffect(() => {
    registry.set(station.id, materials);
    return () => {
      registry.delete(station.id);
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [station.id, materials]);
  useEffect(() => () => outline.dispose(), [outline]);
  useEffect(() => () => halo.dispose(), [halo]);
  useEffect(() => () => outlineGeometry.dispose(), [outlineGeometry]);
  useEffect(() => () => haloGeometry.dispose(), [haloGeometry]);

  // Written in the frame the event is applied; nothing here touches React state.
  useFrame(() => {
    const state = session.stationStates().get(station.id);
    const t = getTheme();
    for (const s of lightSegments(state, t)) {
      const m = materials[s.segment];
      m.color.set(s.lit ? s.color : t.scene.parts.dark);
      if (s.lit) m.emissive.set(s.color);
      else m.emissive.setScalar(0);
      m.emissiveIntensity = s.lit ? 1.4 : 0;
    }
    outline.color.set(
      state ? t.state[lightSegments(state, t).find((s) => s.lit)!.segment].strong : noStateColor(t),
    );
  });

  return (
    <group
      position={[station.position.x, 0, station.position.y]}
      rotation={[0, -station.rotation, 0]}
    >
      <group position={light}>
        {LIGHT_ORDER.map((s, i) => (
          <mesh key={s} position={[0, SEGMENT_H * (i + 0.5), 0]} material={materials[s]}>
            <cylinderGeometry args={[SEGMENT_R, SEGMENT_R, SEGMENT_H * 0.92, 16]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, OUTLINE_Y, 0]} material={outline} geometry={outlineGeometry} />
      {flagged && <mesh position={[0, OUTLINE_Y / 2, 0]} material={halo} geometry={haloGeometry} />}
    </group>
  );
}
