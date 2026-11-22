import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from './editorStore';
import { buildGridGeometry } from './gridLayout';
import { EquipmentLayer, FloorInteraction, LibraryDropTarget } from './EquipmentLayer';
import { fitCamera, labelLayout } from './cameraFit';
import { formatLength } from './units';

/** Floor plan (x, y) maps to three's ground plane (x, z); y is up. */
function GridLines() {
  const floor = useEditorStore((s) => s.floor);
  const geometry = useMemo(() => buildGridGeometry(floor), [floor]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floor.width / 2, -0.01, floor.length / 2]}>
        <planeGeometry args={[floor.width, floor.length]} />
        <meshBasicMaterial color="#f4f5f7" />
      </mesh>
      <lineSegments geometry={geometry}>
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
 * Fits the camera on mount and whenever "Zoom to fit" is pressed, never on its own after that:
 * floor edits and window resizes would otherwise throw away the user's orbit (#57). This is
 * the only place the initial pose is set.
 */
function CameraRig() {
  const fitTick = useEditorStore((s) => s.fitTick);
  const camera = useThree((s) => s.camera);
  const getThree = useThree((s) => s.get);
  const controls = useThree((s) => s.controls) as {
    target: { set(...a: number[]): void };
    update(): void;
  } | null;
  useEffect(() => {
    const { size } = getThree();
    const { floor } = useEditorStore.getState();
    const fovDeg = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    const fit = fitCamera({
      width: floor.width,
      length: floor.length,
      aspect: size.width / size.height,
      fovDeg,
    });
    camera.position.set(...fit.position);
    controls?.target.set(...fit.target);
    controls?.update();
  }, [fitTick, camera, controls, getThree]);
  return null;
}

export function FloorScene() {
  return (
    <Canvas camera={{ fov: 45, far: 5000 }}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 8]} intensity={2} />
      <GridLines />
      <DimensionLabels />
      <EquipmentLayer />
      <FloorInteraction />
      <LibraryDropTarget />
      <CameraRig />
      {/* Left button is for selecting and dragging equipment; right rotates, wheel zooms. */}
      <OrbitControls
        makeDefault
        mouseButtons={{ MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE } as never}
      />
    </Canvas>
  );
}
