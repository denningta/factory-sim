import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RunSession } from './runSession';

/** Parts beyond this are not drawn; a 5-station line holds a few dozen. */
const MAX_PARTS = 2000;
// Small enough to sit in the models' queue slots (0.35 m pitch).
const PART_SIZE = 0.3;
// Parts being processed sit on top of the machine so they aren't hidden inside it.
const PART_Y = 0.5;
const PROCESSING_Y = 2.4;
/** A long frame (tab in background) must not jump the sim clock. */
const MAX_FRAME_S = 0.1;

/**
 * Draws every part as one instance of one mesh and steps the sim clock each frame. The parts
 * are positioned for `run.now`, the sim clock, never for wall time, so any speed and any
 * frame rate show the same picture for the same sim time (ADR-0008). No React state per frame.
 */
export function PartLayer({ session }: { session: RunSession }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.BoxGeometry(PART_SIZE, PART_SIZE, PART_SIZE),
      new THREE.MeshStandardMaterial(),
      MAX_PARTS,
    );
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  const scratch = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color() }), []);

  useFrame((_, delta) => {
    session.frame(Math.min(delta, MAX_FRAME_S));
    const poses = session.poses(session.now);
    const n = Math.min(poses.length, MAX_PARTS);
    for (let i = 0; i < n; i++) {
      const p = poses[i]!;
      // Queued parts rest on their slot anchor; the pose gives the slot's height.
      const y =
        p.state === 'processing'
          ? PROCESSING_Y
          : p.state === 'queued'
            ? p.y + PART_SIZE / 2
            : PART_Y;
      scratch.m.makeTranslation(p.x, y, p.z);
      mesh.setMatrixAt(i, scratch.m);
      mesh.setColorAt(i, scratch.c.set(p.color));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
