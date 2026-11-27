import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PortRef } from '@factory-sim/schema';
import { useTheme } from '../ui/themeStore';
import { portColors, portVisual, type PortKind } from './portMarkers';

/** Metres across a marker at scale 1. */
const SIZE = 0.6;
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

/** A port to draw: where it sits and the state that decides how it looks. */
export interface PortSpot {
  ref: PortRef;
  key: string;
  kind: PortKind;
  position: [number, number, number];
  active: boolean;
  valid: boolean;
  connected: boolean;
}

/** Text as a texture. White ink for labels, which instance colours then tint. */
function useTextTexture(text: string | null, ink: string) {
  const texture = useMemo(() => {
    if (!text) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const px = 64;
    ctx.font = `600 ${px}px sans-serif`;
    canvas.width = Math.ceil(ctx.measureText(text).width) + 16;
    canvas.height = px + 16;
    ctx.font = `600 ${px}px sans-serif`; // resizing resets the context
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return { t, aspect: canvas.width / canvas.height };
  }, [text, ink]);
  useEffect(() => () => texture?.t.dispose(), [texture]);
  return texture;
}

const pillWidth = (kind: PortKind) => SIZE * (kind === 'output' ? 1.5 : 1.15);
const dummy = new THREE.Object3D();

/** Writes one instance: a flat quad lying on the equipment top at `at`, w × h metres. */
function place(mesh: THREE.InstancedMesh, slot: number, at: THREE.Vector3, w: number, h: number) {
  dummy.position.copy(at);
  dummy.quaternion.copy(FLAT);
  dummy.scale.set(w, h, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(slot, dummy.matrix);
}

const isInstanced = (m: unknown): m is THREE.InstancedMesh => m instanceof THREE.InstancedMesh;

/**
 * Every port marker of the floor as three instanced meshes (pills, IN labels, OUT labels) plus
 * one hint sprite for the hovered port, so draw calls don't grow with the number of ports
 * (ADR-0014). Matrices and colours are rewritten when a port's state or the hover changes.
 */
export function PortMarkers({
  spots,
  pending,
  onPort,
}: {
  spots: readonly PortSpot[];
  pending: PortRef | null;
  onPort: (ref: PortRef, e: ThreeEvent<PointerEvent>) => void;
}) {
  const theme = useTheme();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const pills = useRef<THREE.InstancedMesh>(null);
  const inLabels = useRef<THREE.InstancedMesh>(null);
  const outLabels = useRef<THREE.InstancedMesh>(null);
  const inTex = useTextTexture('IN', '#ffffff');
  const outTex = useTextTexture('OUT', '#ffffff');
  const visuals = useMemo(
    () =>
      spots.map((s) =>
        portVisual({
          kind: s.kind,
          connected: s.connected,
          hovered: s.key === hoverKey,
          pending,
          active: s.active,
          valid: s.valid,
        }),
      ),
    [spots, hoverKey, pending],
  );
  const hovered = spots.findIndex((s) => s.key === hoverKey);
  const hintText = hovered >= 0 ? visuals[hovered]!.hint : null;
  const hint = useTextTexture(hintText, theme.scene.label);

  useLayoutEffect(() => {
    if (!isInstanced(pills.current)) return; // unit tests render DOM stand-ins
    const floor = new THREE.Color(theme.scene.floor);
    const fill = new THREE.Color();
    const ink = new THREE.Color();
    const at = new THREE.Vector3();
    const counts = { input: 0, output: 0 };
    spots.forEach((s, i) => {
      const v = visuals[i]!;
      const c = portColors({ kind: s.kind, active: s.active, valid: s.valid }, theme);
      // Instance colour has no alpha, so dimming blends toward the floor instead.
      fill.set(c.fill).lerp(floor, 1 - v.opacity);
      at.set(...s.position);
      place(pills.current!, i, at, pillWidth(s.kind) * v.scale, SIZE * 0.7 * v.scale);
      pills.current!.setColorAt(i, fill);
      const labels = s.kind === 'output' ? outLabels.current : inLabels.current;
      const tex = s.kind === 'output' ? outTex : inTex;
      if (!v.showLabel || !isInstanced(labels) || !tex) return;
      const slot = counts[s.kind]++;
      ink.set(c.ink).lerp(fill, 1 - v.opacity);
      place(
        labels,
        slot,
        at.set(s.position[0], s.position[1] + 0.01 * v.scale, s.position[2]),
        SIZE * 0.45 * tex.aspect * v.scale,
        SIZE * 0.45 * v.scale,
      );
      labels.setColorAt(slot, ink);
    });
    pills.current.count = spots.length;
    pills.current.instanceMatrix.needsUpdate = true;
    if (pills.current.instanceColor) pills.current.instanceColor.needsUpdate = true;
    pills.current.computeBoundingSphere();
    for (const [kind, labels] of [
      ['input', inLabels.current],
      ['output', outLabels.current],
    ] as const) {
      if (!isInstanced(labels)) continue;
      labels.count = counts[kind];
      labels.instanceMatrix.needsUpdate = true;
      if (labels.instanceColor) labels.instanceColor.needsUpdate = true;
      labels.computeBoundingSphere();
    }
  }, [spots, visuals, theme, inTex, outTex]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );
  const hover = (key: string | null) => {
    setHoverKey(key);
    document.body.style.cursor = key ? 'pointer' : '';
  };
  const spotOf = (e: ThreeEvent<PointerEvent>) =>
    e.instanceId === undefined ? undefined : spots[e.instanceId];

  const n = spots.length;
  if (n === 0) return null;
  return (
    <>
      <instancedMesh
        key={`pills:${n}`}
        ref={pills}
        args={[undefined, undefined, n]}
        renderOrder={3}
        onPointerDown={(e) => {
          const s = spotOf(e);
          if (s) onPort(s.ref, e);
        }}
        onPointerMove={(e) => {
          const s = spotOf(e);
          if (s && s.key !== hoverKey) hover(s.key);
        }}
        onPointerOut={() => hover(null)}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial depthTest={false} />
      </instancedMesh>
      {(
        [
          ['input', inLabels, inTex],
          ['output', outLabels, outTex],
        ] as const
      ).map(([kind, ref, tex]) => (
        <instancedMesh
          key={`${kind}:${n}`}
          ref={ref}
          args={[undefined, undefined, n]}
          renderOrder={4}
          raycast={() => null}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex?.t ?? null} transparent depthTest={false} />
        </instancedMesh>
      ))}
      {hovered >= 0 && hint && (
        <sprite
          position={[
            spots[hovered]!.position[0],
            spots[hovered]!.position[1] + 0.9,
            spots[hovered]!.position[2],
          ]}
          scale={[0.5 * hint.aspect, 0.5, 1]}
          renderOrder={5}
        >
          <spriteMaterial map={hint.t} transparent depthTest={false} />
        </sprite>
      )}
    </>
  );
}
