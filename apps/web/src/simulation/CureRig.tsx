import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Equipment } from '@factory-sim/schema';
import { buildModel } from '../equipment/models/registry';
import { useTheme } from '../ui/themeStore';
import type { RunSession } from './runSession';

/** How far the hatch swings open (rad). */
const DOOR_OPEN = 1.75;
const BAR_H = 0.1;

/**
 * An autoclave's moving parts (SF-5): the hatch, the cart that carries the batch in and the
 * cure progress bar. Driven from the sim clock through refs every frame; no React state.
 */
export function CureRig({ session, station }: { session: RunSession; station: Equipment }) {
  const rig = useMemo(() => buildModel(station).anchors.cure, [station]);
  const theme = useTheme();
  const door = useRef<THREE.Group>(null);
  const cart = useRef<THREE.Mesh>(null);
  const bar = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!rig) return;
    const s = session.cureState(station.id, session.now);
    if (door.current) door.current.rotation.y = s.door * DOOR_OPEN;
    if (cart.current) {
      cart.current.position.z = rig.cart.center[2] - rig.cart.travel * s.cart;
      cart.current.visible = s.cart > 0;
    }
    if (bar.current) {
      bar.current.visible = s.progress !== null;
      bar.current.scale.x = Math.max(1e-3, s.progress ?? 0);
    }
  });
  if (!rig) return null;

  const { door: d, cart: c, progress: p } = rig;
  return (
    <group
      position={[station.position.x, 0, station.position.y]}
      rotation={[0, -station.rotation, 0]}
    >
      {/* Hinged at the right edge; closed it covers the vessel mouth. */}
      <group ref={door} position={[d.center[0] + d.radius, d.center[1], d.center[2]]}>
        <mesh position={[-d.radius, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[d.radius, d.radius, 0.05, 32]} />
          <meshStandardMaterial color={theme.scene.parts.accent} />
        </mesh>
      </group>
      <mesh ref={cart} position={c.center} visible={false}>
        <boxGeometry args={c.size} />
        <meshStandardMaterial color={theme.scene.parts.frame} />
      </mesh>
      <group
        ref={bar}
        position={[p.center[0] - p.width / 2, p.center[1], p.center[2]]}
        visible={false}
      >
        <mesh position={[p.width / 2, 0, 0]}>
          <boxGeometry args={[p.width, BAR_H, BAR_H]} />
          <meshBasicMaterial color={theme.color.accent} />
        </mesh>
      </group>
    </group>
  );
}
