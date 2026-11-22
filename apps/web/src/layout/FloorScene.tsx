import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from './editorStore';
import { gridLayout } from './gridLayout';
import { formatLength } from './units';

/** Floor plan (x, y) maps to three's ground plane (x, z); y is up. */
function GridLines() {
  const floor = useEditorStore((s) => s.floor);
  const geometry = useMemo(() => {
    const { xs, ys } = gridLayout(floor);
    const pts: number[] = [];
    for (const x of xs) pts.push(x, 0, 0, x, 0, floor.length);
    for (const y of ys) pts.push(0, 0, y, floor.width, 0, y);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [floor]);
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

function DimensionLabels() {
  const floor = useEditorStore((s) => s.floor);
  const unit = useEditorStore((s) => s.unit);
  const style = { font: '12px sans-serif', color: '#374151', whiteSpace: 'nowrap' as const };
  return (
    <>
      <Html position={[floor.width / 2, 0, -1]} center>
        <div style={style}>{formatLength(floor.width, unit)}</div>
      </Html>
      <Html position={[-1, 0, floor.length / 2]} center>
        <div style={style}>{formatLength(floor.length, unit)}</div>
      </Html>
      <Html position={[0, 0, floor.length + 1]} center>
        <div style={style}>grid {formatLength(floor.gridSpacing, unit)}</div>
      </Html>
    </>
  );
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
      <OrbitControls target={[cx, 0, cz]} makeDefault />
    </Canvas>
  );
}
