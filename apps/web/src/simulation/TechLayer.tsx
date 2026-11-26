import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextLabel } from '../layout/FloorScene';
import type { RunSession } from './runSession';
import { getTheme } from '../ui/themeStore';
import { createFigureGeometries, FIGURE, limbAngles } from './techFigure';

const BODY_HEIGHT = 1.7;
const LABEL_HEIGHT = 1.1;

const tmp = new THREE.Matrix4();
const body = new THREE.Matrix4();
const local = new THREE.Matrix4();
const rot = new THREE.Matrix4();
const color = new THREE.Color();

/**
 * Techs are simplified people (ADR-0014: a handful of instanced meshes for all of them), drawn at
 * the sim clock's pose like parts (ADR-0008). Matrices are written per frame straight into the
 * instance buffers: no React state per frame. Names float above as labels.
 */
export function TechLayer({ session }: { session: RunSession }) {
  // Re-read when animation is toggled (Running re-renders on that); empty while it's off.
  const techs = session.techPoses(0);
  const key = techs.map((t) => t.techId).join('|');
  return (
    <>
      <TechFigures key={key} session={session} ids={techs.map((t) => t.techId)} />
      {techs.map((t) => (
        <TechLabel key={t.techId} session={session} id={t.techId} name={t.name} />
      ))}
    </>
  );
}

function TechFigures({ session, ids }: { session: RunSession; ids: string[] }) {
  const n = ids.length;
  const geo = useMemo(createFigureGeometries, []);
  const refs = {
    head: useRef<THREE.InstancedMesh>(null),
    torso: useRef<THREE.InstancedMesh>(null),
    vest: useRef<THREE.InstancedMesh>(null),
    arm: useRef<THREE.InstancedMesh>(null),
    leg: useRef<THREE.InstancedMesh>(null),
  };
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
    },
    [geo],
  );

  useFrame(() => {
    const { head, torso, vest, arm, leg } = refs;
    if (!head.current || !torso.current || !vest.current || !arm.current || !leg.current) return;
    const poses = new Map(session.techPoses(session.now).map((p) => [p.techId, p]));
    const { state, scene } = getTheme();
    ids.forEach((id, i) => {
      const pose = poses.get(id);
      if (!pose) {
        // Hidden: collapse every part of this figure to nothing.
        tmp.makeScale(0, 0, 0);
        for (const m of [head, torso, vest]) m.current!.setMatrixAt(i, tmp);
        for (let k = 0; k < 2; k++) {
          arm.current!.setMatrixAt(2 * i + k, tmp);
          leg.current!.setMatrixAt(2 * i + k, tmp);
        }
        return;
      }
      body.makeRotationY(pose.heading).setPosition(pose.x, 0, pose.z);
      for (const m of [head, torso, vest]) m.current!.setMatrixAt(i, body);
      const limbs = limbAngles(pose);
      const swing = (mesh: THREE.InstancedMesh, k: number, x: number, y: number, a: number) => {
        // Positive angle swings the limb forward (+z): that is a negative turn about x.
        local.makeTranslation(x, y, 0);
        rot.makeRotationX(-a);
        tmp.multiplyMatrices(body, local).multiply(rot);
        mesh.setMatrixAt(k, tmp);
      };
      swing(arm.current!, 2 * i, -FIGURE.armX, FIGURE.shoulderY, limbs.armL);
      swing(arm.current!, 2 * i + 1, FIGURE.armX, FIGURE.shoulderY, limbs.armR);
      swing(leg.current!, 2 * i, -FIGURE.legX, FIGURE.hipY, limbs.legL);
      swing(leg.current!, 2 * i + 1, FIGURE.legX, FIGURE.hipY, limbs.legR);
      vest.current!.setColorAt(
        i,
        color.set(pose.state === 'walking' ? state.walking.strong : state.waiting.strong),
      );
    });
    for (const m of [head, torso, vest, arm, leg]) {
      m.current!.instanceMatrix.needsUpdate = true;
    }
    if (vest.current.instanceColor) vest.current.instanceColor.needsUpdate = true;
    // Body parts follow the active theme (it can change while running).
    const paint = (m: THREE.InstancedMesh, c: string) =>
      (m.material as THREE.MeshStandardMaterial).color.set(c);
    // The vest's colour comes per instance; its material stays white so it isn't tinted twice.
    (vest.current.material as THREE.MeshStandardMaterial).color.setRGB(1, 1, 1);
    paint(head.current, scene.parts.accent);
    paint(torso.current, scene.parts.dark);
    paint(arm.current, scene.parts.frame);
    paint(leg.current, scene.parts.dark);
  });

  const { scene } = getTheme();
  if (n === 0) return null;
  return (
    <>
      <instancedMesh ref={refs.head} args={[geo.head, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial color={scene.parts.accent} />
      </instancedMesh>
      <instancedMesh ref={refs.torso} args={[geo.torso, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial color={scene.parts.dark} />
      </instancedMesh>
      <instancedMesh ref={refs.vest} args={[geo.vest, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={refs.arm} args={[geo.arm, undefined, 2 * n]} frustumCulled={false}>
        <meshStandardMaterial color={scene.parts.frame} />
      </instancedMesh>
      <instancedMesh ref={refs.leg} args={[geo.leg, undefined, 2 * n]} frustumCulled={false}>
        <meshStandardMaterial color={scene.parts.dark} />
      </instancedMesh>
    </>
  );
}

function TechLabel({ session, id, name }: { session: RunSession; id: string; name: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const pose = session.techPoses(session.now).find((p) => p.techId === id);
    if (!group.current) return;
    group.current.visible = !!pose;
    if (pose) group.current.position.set(pose.x, 0, pose.z);
  });
  return (
    <group ref={group}>
      <TextLabel
        text={name}
        position={[0, BODY_HEIGHT + LABEL_HEIGHT * 0.8, 0]}
        height={LABEL_HEIGHT}
      />
    </group>
  );
}
