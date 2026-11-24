import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Equipment } from '@factory-sim/schema';
import { TextLabel } from '../layout/FloorScene';
import type { RunSession } from './runSession';
import { findBottleneck, NO_STATE_COLOR, plateColor } from './stationStatus';
import { stationUtilization } from './utilization';

/** Lifted off the machine top so the plate never z-fights with it. */
const LIFT = 0.04;
const PLATE_THICKNESS = 0.12;
// Dark, not red: red is the blocked plate color.
const BOTTLENECK_COLOR = '#1f2937';
/** The flag is a text figure like the KPIs: a few updates a second, not per frame. */
const FLAG_INTERVAL_MS = 200;

/**
 * Each workstation gets a plate on top colored by its live state (working green, starved
 * yellow, blocked red, idle gray) and the bottleneck gets a red ring and label. State colors
 * are written through refs from the sim clock's latest event; only the flag, which moves
 * rarely, goes through React state.
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
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: NO_STATE_COLOR }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const state = session.stationStates().get(station.id);
    material.color.set(plateColor(state));
  });
  const top = station.height;
  return (
    <group
      position={[station.position.x, 0, station.position.y]}
      rotation={[0, -station.rotation, 0]}
    >
      <mesh position={[0, top + LIFT + PLATE_THICKNESS / 2, 0]} material={material}>
        <boxGeometry args={[width * 0.9, PLATE_THICKNESS, length * 0.9]} />
      </mesh>
      {flagged && (
        <>
          <mesh position={[0, top + LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[Math.hypot(width, length) / 2 + 0.1, Math.hypot(width, length) / 2 + 0.3, 48]}
            />
            <meshBasicMaterial color={BOTTLENECK_COLOR} side={THREE.DoubleSide} />
          </mesh>
          <TextLabel text="BOTTLENECK" position={[0, top + 1.6, 0]} height={0.7} />
        </>
      )}
    </group>
  );
}
