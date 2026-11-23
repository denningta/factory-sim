import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextLabel } from '../layout/FloorScene';
import type { RunSession } from './runSession';

const BODY_HEIGHT = 1.7;
const BODY_RADIUS = 0.3;
const LABEL_HEIGHT = 1.1;
const WALKING_COLOR = '#f59e0b';
const STANDING_COLOR = '#4f46e5';

/**
 * A tech is a capsule with its name floating above, drawn at the sim clock's pose (like parts,
 * ADR-0008). Few techs, so one small group each, moved through refs: no React state per frame.
 */
export function TechLayer({ session }: { session: RunSession }) {
  // Who exists doesn't change during a run, only where they are.
  const techs = useMemo(() => session.techPoses(0), [session]);
  return (
    <>
      {techs.map((t) => (
        <TechMarker key={t.techId} session={session} id={t.techId} name={t.name} />
      ))}
    </>
  );
}

function TechMarker({ session, id, name }: { session: RunSession; id: string; name: string }) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: STANDING_COLOR }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const pose = session.techPoses(session.now).find((p) => p.techId === id);
    if (!group.current || !pose) return;
    group.current.position.set(pose.x, 0, pose.z);
    material.color.set(pose.state === 'walking' ? WALKING_COLOR : STANDING_COLOR);
  });
  return (
    <group ref={group}>
      <mesh position={[0, BODY_HEIGHT / 2, 0]} material={material}>
        <capsuleGeometry args={[BODY_RADIUS, BODY_HEIGHT - 2 * BODY_RADIUS, 4, 12]} />
      </mesh>
      <TextLabel text={name} position={[0, BODY_HEIGHT + LABEL_HEIGHT * 0.8, 0]} height={LABEL_HEIGHT} />
    </group>
  );
}
