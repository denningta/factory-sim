import { useEffect, useMemo, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from './editorStore';
import { buildGridGeometry } from './gridLayout';
import { ConnectionLayer } from './ConnectionLayer';
import { EquipmentLayer, FloorInteraction, LibraryDropTarget } from './EquipmentLayer';
import { aspectOf, fitCamera, fitOrtho, fitScale, labelLayout } from './cameraFit';
import { controlSettings } from './viewControls';
import { formatLength } from './units';
import { useTheme } from '../ui/themeStore';

/** Floor plan (x, y) maps to three's ground plane (x, z); y is up. */
function GridLines() {
  const floor = useEditorStore((s) => s.floor);
  const scene = useTheme().scene;
  const geometry = useMemo(() => buildGridGeometry(floor), [floor]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floor.width / 2, -0.01, floor.length / 2]}>
        <planeGeometry args={[floor.width, floor.length]} />
        <meshBasicMaterial color={scene.floor} />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={scene.grid} />
      </lineSegments>
    </>
  );
}

/**
 * Text as a sprite with a canvas texture, sized in world meters so labels scale with the
 * floor. drei's Html mounts a React root per label, which misbehaves under React 19.
 */
export function TextLabel({
  text,
  position,
  height,
}: {
  text: string;
  position: Vec3;
  height: number;
}) {
  const ink = useTheme().scene.label;
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const px = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { texture: null, aspect: 1 };
    ctx.font = `${px}px sans-serif`;
    canvas.width = Math.ceil(ctx.measureText(text).width) + 8;
    canvas.height = px + 12;
    ctx.font = `${px}px sans-serif`; // resizing the canvas resets the context
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 4, canvas.height / 2);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: canvas.width / canvas.height };
  }, [text, ink]);
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
 * Fits the camera on mount, when equipment first appears, on a 2D/3D switch and whenever "Zoom to fit" is pressed, never on its own after that:
 * floor edits and window resizes would otherwise throw away the user's orbit (#57). This is
 * the only place the initial pose is set.
 */
function CameraRig() {
  const fitTick = useEditorStore((s) => s.fitTick);
  const viewMode = useEditorStore((s) => s.viewMode);
  const camera = useThree((s) => s.camera);
  const getThree = useThree((s) => s.get);
  const controls = useThree((s) => s.controls) as {
    target: { set(...a: number[]): void };
    update(): void;
  } | null;
  // The canvas can be 0×0 on mount (e.g. inside a shell that lays out later); fitting then would
  // use a NaN aspect. `ready` flips once when it first has a size, which triggers the first fit.
  const ready = useThree((s) => aspectOf(s.size) !== null);
  // Equipment often arrives after mount (project load). Refit when the floor first has some, not
  // on every edit, so the user's orbit survives.
  const hasEquipment = useEditorStore((s) => s.equipment.length > 0);
  useEffect(() => {
    const aspect = aspectOf(getThree().size);
    if (aspect === null) return;
    const { floor } = useEditorStore.getState();
    if (camera instanceof THREE.OrthographicCamera) {
      const { size } = getThree();
      const fit = fitOrtho({ width: floor.width, length: floor.length, viewport: size });
      camera.zoom = fit.zoom;
      camera.position.set(...fit.position);
      camera.updateProjectionMatrix();
      controls?.target.set(...fit.target);
      controls?.update();
      return;
    }
    const fovDeg = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    const fit = fitCamera({
      width: floor.width,
      length: floor.length,
      aspect,
      fovDeg,
      equipment: useEditorStore.getState().equipment,
    });
    camera.position.set(...fit.position);
    controls?.target.set(...fit.target);
    controls?.update();
  }, [fitTick, viewMode, ready, hasEquipment, camera, controls, getThree]);
  return null;
}

/** Orbit controls; the limits follow the fitted pose, so they depend on floor and canvas size. */
function Controls() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const floor = useEditorStore((s) => s.floor);
  const size = useThree((s) => s.size);
  const settings = controlSettings(viewMode, fitScale(floor, size));
  // The left button selects and drags equipment; see controlSettings.
  return (
    <OrbitControls
      key={viewMode}
      makeDefault
      enableRotate={settings.enableRotate}
      mouseButtons={settings.mouseButtons}
      maxPolarAngle={settings.maxPolarAngle}
      minDistance={settings.minDistance}
      maxDistance={settings.maxDistance}
      minZoom={settings.minZoom}
      maxZoom={settings.maxZoom}
    />
  );
}

/**
 * The floor with its equipment and connections. `children` render inside the canvas (the
 * simulation's parts); `interactive={false}` drops editing gestures for the simulate screen.
 */
export function FloorScene({
  children,
  interactive = true,
}: {
  children?: ReactNode;
  interactive?: boolean;
}) {
  const viewMode = useEditorStore((s) => s.viewMode);
  const scene = useTheme().scene;
  return (
    <Canvas
      onCreated={({ gl, scene: s3 }) => {
        (window as unknown as { __scene?: unknown }).__scene = s3;
        // Dev-only handle for the SF-8 performance check (renderer.info); absent in production.
        if (import.meta.env.DEV)
          (window as unknown as { __rendererInfo?: unknown }).__rendererInfo = gl.info;
      }}
    >
      <color attach="background" args={[scene.background]} />
      {viewMode === '3d' ? (
        <PerspectiveCamera makeDefault fov={45} far={5000} />
      ) : (
        // up = -z so plan +y runs down the screen, as in the 3D plan orientation.
        <OrthographicCamera makeDefault up={[0, 0, -1]} near={0.1} far={5000} />
      )}
      <ambientLight intensity={scene.ambient} />
      <directionalLight position={[10, 20, 8]} intensity={scene.key} />
      <GridLines />
      <DimensionLabels />
      <EquipmentLayer />
      {/* The simulation draws its own glowing connections (ConnectionArcs). */}
      {interactive && <ConnectionLayer />}
      {interactive && <FloorInteraction />}
      {interactive && <LibraryDropTarget />}
      {children}
      <CameraRig />
      <Controls />
    </Canvas>
  );
}
