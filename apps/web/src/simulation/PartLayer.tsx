import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Playback } from './playback';

/** Parts beyond this are not drawn; a 5-station line holds a few dozen. */
const MAX_PARTS = 2000;
const PART_SIZE = 0.35;
const PART_Y = 1;
/** A long frame (tab in background) must not jump the sim clock. */
const MAX_FRAME_S = 0.1;

export interface PlaybackControl {
  playback: Playback;
  playing: boolean;
}

/**
 * Draws every part as one instance of one mesh and steps the sim clock each frame. The parts
 * are positioned for `run.now`, the sim clock, never for wall time, so any speed and any
 * frame rate show the same picture for the same sim time (ADR-0008). No React state per frame.
 */
export function PartLayer({ control }: { control: { current: PlaybackControl } }) {
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
    const { playback, playing } = control.current;
    if (playing && !playback.run.done) playback.advance(Math.min(delta, MAX_FRAME_S));
    const poses = playback.animate ? playback.tracks.at(playback.run.now) : [];
    const n = Math.min(poses.length, MAX_PARTS);
    for (let i = 0; i < n; i++) {
      const p = poses[i]!;
      scratch.m.makeTranslation(p.x, PART_Y, p.z);
      mesh.setMatrixAt(i, scratch.m);
      mesh.setColorAt(i, scratch.c.set(p.color));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
