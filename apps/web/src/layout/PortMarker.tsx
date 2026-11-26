import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useTheme } from '../ui/themeStore';
import { portColors, type PortVisual } from './portMarkers';

/** Metres across a marker at scale 1. */
const SIZE = 0.6;

/** White-on-transparent text as a texture; tinted by the material so theme changes are cheap. */
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

export function PortMarker({
  name,
  position,
  kind,
  visual,
  active,
  highlight = false,
  onHover,
  onPointerDown,
}: {
  name: string;
  position: [number, number, number];
  kind: 'input' | 'output';
  /** Visual state minus hover, which the marker tracks itself. */
  visual: (hovered: boolean) => PortVisual;
  active: boolean;
  /** A valid target while connecting: drawn in the accent colour. */
  highlight?: boolean;
  onHover?: (hovered: boolean) => void;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const v = visual(hovered);
  const { fill, ink } = portColors({ kind, active, valid: highlight }, theme);
  const label = useTextTexture(kind === 'output' ? 'OUT' : 'IN', ink);
  const hint = useTextTexture(v.hint, theme.scene.label);
  const hover = (on: boolean) => () => {
    setHovered(on);
    onHover?.(on);
    document.body.style.cursor = on ? 'pointer' : '';
  };
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );
  const w = SIZE * (kind === 'output' ? 1.5 : 1.15);
  return (
    <group
      position={position}
      name={name}
      onPointerDown={onPointerDown}
      onPointerOver={hover(true)}
      onPointerOut={hover(false)}
    >
      <group scale={v.scale} renderOrder={3}>
        {/* Flat pill lying on the equipment top. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <planeGeometry args={[w, SIZE * 0.7]} />
          <meshBasicMaterial color={fill} transparent opacity={v.opacity} depthTest={false} />
        </mesh>
        {v.showLabel && label && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} renderOrder={4}>
            <planeGeometry args={[SIZE * 0.45 * label.aspect, SIZE * 0.45]} />
            <meshBasicMaterial map={label.t} transparent opacity={v.opacity} depthTest={false} />
          </mesh>
        )}
      </group>
      {v.hint && hint && (
        <sprite position={[0, 0.9, 0]} scale={[0.5 * hint.aspect, 0.5, 1]} renderOrder={5}>
          <spriteMaterial map={hint.t} transparent depthTest={false} />
        </sprite>
      )}
    </group>
  );
}
