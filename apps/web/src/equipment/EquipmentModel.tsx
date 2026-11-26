import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { EquipmentType } from '@factory-sim/schema';
import { unitGeometryArgs } from '../layout/equipmentGroups';
import { writePartMatrix } from './models/instances';
import { useTheme, useThemeStore } from '../ui/themeStore';
import { roleColor, roleMaterial } from './models/materials';
import { buildModel, type ModelSource } from './models/registry';
import type { ModelPart } from './models/types';
import styles from './library.module.css';

/** The unit geometry a part's instanced mesh is built on (sized per instance by its matrix). */
export function UnitGeometry({ part }: { part: ModelPart }) {
  const u = unitGeometryArgs(part);
  return u.shape === 'box' ? <boxGeometry args={u.args} /> : <cylinderGeometry args={u.args} />;
}

/** What the preview needs of a type: enough to resolve and build its model. */
export type PreviewType = ModelSource & Pick<EquipmentType, 'color'>;

/** One part drawn the way the floor draws it: a one-slot instanced mesh, shared role material. */
function PreviewPart({ part, color }: { part: ModelPart; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mode = useThemeStore((s) => s.mode);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    writePartMatrix(m, 0, part, { x: 0, y: 0, rotation: 0 });
    m.setColorAt(0, new THREE.Color(roleColor(part.role, color)));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [part, color, mode]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 1]} material={roleMaterial(part.role)}>
      <UnitGeometry part={part} />
    </instancedMesh>
  );
}

/** Renders a type's model at the origin at full detail, in meters. */
export function EquipmentModel({ type }: { type: PreviewType }) {
  const parts = useMemo(() => buildModel(type).lods[0]!, [type]);
  return (
    <group>
      {parts.map((p, i) => (
        <PreviewPart key={i} part={p} color={type.color} />
      ))}
    </group>
  );
}

/** A small canvas previewing a type's model; used by the library and the type editor. */
export function ModelPreview({ type, label }: { type: PreviewType; label?: string }) {
  const reach = Math.max(type.footprint.width, type.footprint.length, type.height);
  const id = buildModel(type).model.id;
  const floor = useTheme().scene.floor;
  return (
    <div
      className={styles.preview}
      // The floor colour comes from the active theme at run time, so it can't live in the CSS file.
      style={{ background: floor }} // eslint-disable-line no-restricted-syntax
      aria-label={label ?? '3D preview'}
      data-model={id}
    >
      <Canvas camera={{ position: [reach * 1.6, reach * 1.2, reach * 1.6], fov: 40 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 2]} intensity={2} />
        <group key={id}>
          <EquipmentModel type={type} />
        </group>
        <OrbitControls target={[0, type.height / 2, 0]} />
      </Canvas>
    </div>
  );
}

/** One small canvas previewing the selected library type. */
export function LibraryPreview({ type }: { type: EquipmentType }) {
  return <ModelPreview type={type} label={`3D preview of ${type.name}`} />;
}
