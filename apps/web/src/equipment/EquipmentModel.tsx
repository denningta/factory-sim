import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { EquipmentType } from '@factory-sim/schema';
import { equipmentParts } from './shapes';

/** Renders one type's model at the origin, in meters. */
export function EquipmentModel({ type }: { type: EquipmentType }) {
  const parts = useMemo(() => equipmentParts(type), [type]);
  const base = useMemo(() => new THREE.Color(type.color), [type.color]);
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={p.position}>
          {p.shape === 'box' ? (
            <boxGeometry args={p.size} />
          ) : (
            <cylinderGeometry args={[p.radiusTop, p.radiusBottom, p.height, 24]} />
          )}
          <meshStandardMaterial color={base.clone().multiplyScalar(p.tone)} />
        </mesh>
      ))}
    </group>
  );
}

/** One small canvas previewing the selected library type. */
export function LibraryPreview({ type }: { type: EquipmentType }) {
  const reach = Math.max(type.footprint.width, type.footprint.length, type.height);
  return (
    <div style={{ height: 200, background: '#f4f5f7' }} aria-label={`3D preview of ${type.name}`}>
      <Canvas camera={{ position: [reach * 1.6, reach * 1.2, reach * 1.6], fov: 40 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 2]} intensity={2} />
        <group key={type.id}>
          <EquipmentModel type={type} />
        </group>
        <OrbitControls target={[0, type.height / 2, 0]} />
      </Canvas>
    </div>
  );
}
