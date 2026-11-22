import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from './editorStore';
import { gridLinePositions } from './gridLayout';
import { fitCamera, labelLayout } from './cameraFit';
import { formatLength } from './units';

/** Floor plan (x, y) maps to three's ground plane (x, z); y is up. */
function GridLines() {
  const floor = useEditorStore((s) => s.floor);
  const positions = useMemo(() => new Float32Array(gridLinePositions(floor)), [floor]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floor.width / 2, -0.01, floor.length / 2]}>
        <planeGeometry args={[floor.width, floor.length]} />
        <meshBasicMaterial color="#f4f5f7" />
      </mesh>
      <lineSegments>
        {/* Declared in JSX so R3F disposes the old geometry when the floor changes. */}
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#c3c8d0" />
      </lineSegments>
    </>
  );
}

/**
 * Text as a sprite with a canvas texture, sized in world meters so labels scale with the
 * floor. drei's Html mounts a React root per label, which misbehaves under React 19.
 */
function TextLabel({ text, position, height }: { text: string; position: Vec3; height: number }) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const px = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { texture: null, aspect: 1 };
    ctx.font = `${px}px sans-serif`;
    canvas.width = Math.ceil(ctx.measureText(text).width) + 8;
    canvas.height = px + 12;
    ctx.font = `${px}px sans-serif`; // resizing the canvas resets the context
    ctx.fillStyle = '#374151';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 4, canvas.height / 2);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: canvas.width / canvas.height };
  }, [text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

type Vec3 = [number, number, number];

function DimensionLabels() {
  const floor = useEditorStore((s) => s.floor);
  const unit = useEditorStore((s) => s.unit);
  const { textHeight: h, widthLabel, lengthLabel, gridLabel } = labelLayout(floor);
  return (
    <>
      <TextLabel text={formatLength(floor.width, unit)} position={widthLabel} height={h} />
      <TextLabel text={formatLength(floor.length, unit)} position={lengthLabel} height={h} />
      <TextLabel
        text={`grid ${formatLength(floor.gridSpacing, unit)}`}
        position={gridLabel}
        height={h}
      />
    </>
  );
}

/**
 * Refits the camera when the floor size or the canvas size changes, so the floor and its labels
 * fill the canvas whatever its aspect (the Canvas camera prop only applies once).
 */
function CameraRig() {
  const width = useEditorStore((s) => s.floor.width);
  const length = useEditorStore((s) => s.floor.length);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target: { set(...a: number[]): void };
    update(): void;
  } | null;
  useEffect(() => {
    const fovDeg = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    const fit = fitCamera({ width, length, aspect: size.width / size.height, fovDeg });
    camera.position.set(...fit.position);
    controls?.target.set(...fit.target);
    controls?.update();
  }, [width, length, size.width, size.height, camera, controls]);
  return null;
}

export function FloorScene() {
  const floor = useEditorStore((s) => s.floor);
  const cx = floor.width / 2;
  const cz = floor.length / 2;
  const reach = Math.max(floor.width, floor.length);
  return (
    <Canvas camera={{ position: [cx, reach * 0.9, cz + reach * 0.9], fov: 45, far: 5000 }}>
      <GridLines />
      <DimensionLabels />
      <CameraRig />
      <OrbitControls target={[cx, 0, cz]} makeDefault />
    </Canvas>
  );
}
