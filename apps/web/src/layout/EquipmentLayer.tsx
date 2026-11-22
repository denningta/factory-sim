import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BASE_EQUIPMENT_TYPES, type Equipment, type EquipmentType } from '@factory-sim/schema';
import { equipmentParts, type Part } from '../equipment/shapes';
import { EQUIPMENT_DRAG_TYPE } from '../equipment/LibraryPanel';
import { useEditorStore } from './editorStore';
import { pointerToFloor } from './picking';
import { dragTargets } from './selection';

type Point = { x: number; y: number };

interface Group {
  type: EquipmentType;
  parts: Part[];
  items: Equipment[];
}

const SELECTED_TINT = new THREE.Color('#2563eb');
const UP = new THREE.Vector3(0, 1, 0);
/** Below this floor distance (m) a drag on empty floor is a click, not a box. */
const CLICK_RADIUS = 0.15;

/** Pointer position on the floor plane for a DOM pointer event, in plan meters. */
function floorPoint(e: { clientX: number; clientY: number }, dom: HTMLElement, cam: THREE.Camera) {
  const r = dom.getBoundingClientRect();
  return pointerToFloor(cam, {
    x: ((e.clientX - r.left) / r.width) * 2 - 1,
    y: -(((e.clientY - r.top) / r.height) * 2 - 1),
  });
}

/** Tracks a pointer drag on window so it survives leaving the canvas; returns a cleanup. */
function trackDrag(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void) {
  const up = (e: PointerEvent) => {
    stop();
    onUp(e);
  };
  const stop = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  return stop;
}

/**
 * Placed equipment, one InstancedMesh per (type, part) (ADR-0014). Matrices are written
 * imperatively: a drag previews through refs and commits to the store once on release, so no
 * React state changes per pointer move.
 */
export function EquipmentLayer() {
  const equipment = useEditorStore((s) => s.equipment);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const gl = useThree((s) => s.gl);
  const getThree = useThree((s) => s.get);
  const meshes = useRef(new Map<string, THREE.InstancedMesh>());
  const stopDrag = useRef<(() => void) | null>(null);

  const groups = useMemo<Group[]>(() => {
    const byType = new Map<string, Group>();
    for (const e of equipment) {
      // EQ-2 will make per-instance geometry editable; until then the type defines the shape.
      const type = BASE_EQUIPMENT_TYPES.find((t) => t.id === e.typeId);
      if (!type) continue;
      const g = byType.get(e.typeId) ?? { type, parts: equipmentParts(type), items: [] };
      g.items.push(e);
      byType.set(e.typeId, g);
    }
    return [...byType.values()];
  }, [equipment]);

  /** Writes every instance matrix and tint; `preview` overrides positions during a drag. */
  const write = (preview: Record<string, Point> | null) => {
    const dummy = new THREE.Object3D();
    const offset = new THREE.Vector3();
    const color = new THREE.Color();
    const selected = new Set(useEditorStore.getState().selectedIds);
    for (const g of groups) {
      g.parts.forEach((part, pi) => {
        const mesh = meshes.current.get(`${g.type.id}:${pi}`);
        if (!mesh) return;
        g.items.forEach((e, i) => {
          const p = preview?.[e.id] ?? e.position;
          offset.set(...part.position).applyAxisAngle(UP, -e.rotation);
          dummy.position.set(p.x + offset.x, offset.y, p.y + offset.z);
          dummy.rotation.set(0, -e.rotation, 0); // plan angle runs x→y, which is -y in three
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          color.set(g.type.color).multiplyScalar(part.tone);
          if (selected.has(e.id)) color.lerp(SELECTED_TINT, 0.55);
          mesh.setColorAt(i, color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere(); // keeps picking and culling right after moves
      });
    }
  };

  // Selection only changes tints, but it still needs a rewrite.
  useLayoutEffect(() => write(null), [groups, selectedIds]);
  useEffect(() => () => stopDrag.current?.(), []);

  const onPointerDown = (g: Group) => (e: ThreeEvent<PointerEvent>) => {
    const item = e.instanceId === undefined ? undefined : g.items[e.instanceId];
    if (!item || e.button !== 0) return;
    e.stopPropagation();
    const store = useEditorStore.getState();
    if (e.shiftKey) return store.selectEquipment(item.id, true);
    // Dragging a selected item moves the whole selection; otherwise it selects just this one.
    if (!store.selectedIds.includes(item.id)) store.selectEquipment(item.id, false);
    const state = useEditorStore.getState();
    const starts: Record<string, Point> = {};
    for (const q of state.equipment)
      if (state.selectedIds.includes(q.id)) starts[q.id] = { ...q.position };
    const dom = gl.domElement;
    // Floor-plane point, not e.point: that is the hit on the object's top face, which would
    // make the first move jump by the object's height.
    const origin = floorPoint(e.nativeEvent, dom, getThree().camera);
    if (!origin) return;
    const deltaOf = (ev: PointerEvent) => {
      const p = floorPoint(ev, dom, getThree().camera);
      return p ? { x: p.x - origin.x, y: p.y - origin.y } : null;
    };
    const snap = () => ({
      spacing: state.floor.gridSpacing,
      enabled: useEditorStore.getState().snapEnabled,
    });
    stopDrag.current?.();
    stopDrag.current = trackDrag(
      (ev) => {
        const d = deltaOf(ev);
        if (d) write(dragTargets(starts, item.id, d, snap()));
      },
      (ev) => {
        stopDrag.current = null;
        const d = deltaOf(ev);
        if (d) useEditorStore.getState().dragSelected(starts, item.id, d);
        write(null);
      },
    );
  };

  return (
    <>
      {groups.map((g) =>
        g.parts.map((part, pi) => (
          <instancedMesh
            // Remount when the count changes: an InstancedMesh's capacity is fixed at creation.
            key={`${g.type.id}:${pi}:${g.items.length}`}
            ref={(m: THREE.InstancedMesh | null) => {
              const k = `${g.type.id}:${pi}`;
              if (m) meshes.current.set(k, m);
              else meshes.current.delete(k);
            }}
            args={[undefined, undefined, g.items.length]}
            onPointerDown={onPointerDown(g)}
          >
            {part.shape === 'box' ? (
              <boxGeometry args={part.size} />
            ) : (
              <cylinderGeometry args={[part.radiusTop, part.radiusBottom, part.height, 24]} />
            )}
            <meshStandardMaterial />
          </instancedMesh>
        )),
      )}
    </>
  );
}

/** Drag on empty floor draws a selection box; a plain click clears the selection. */
export function FloorInteraction() {
  const gl = useThree((s) => s.gl);
  const getThree = useThree((s) => s.get);
  const box = useRef<THREE.Mesh>(null);
  const floor = useEditorStore((s) => s.floor);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const show = (a: Point, b: Point) => {
    const m = box.current;
    if (!m) return;
    m.visible = true;
    m.position.set((a.x + b.x) / 2, 0.02, (a.y + b.y) / 2);
    m.scale.set(Math.max(Math.abs(a.x - b.x), 1e-3), Math.max(Math.abs(a.y - b.y), 1e-3), 1);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const dom = gl.domElement;
    const a = floorPoint(e.nativeEvent, dom, getThree().camera);
    if (!a) return;
    const additive = e.shiftKey;
    const at = (ev: PointerEvent) => floorPoint(ev, dom, getThree().camera);
    stop.current?.();
    stop.current = trackDrag(
      (ev) => {
        const b = at(ev);
        if (b) show(a, b);
      },
      (ev) => {
        stop.current = null;
        if (box.current) box.current.visible = false;
        const b = at(ev) ?? a;
        const store = useEditorStore.getState();
        if (Math.hypot(b.x - a.x, b.y - a.y) < CLICK_RADIUS) {
          if (!additive) store.clearSelection();
        } else store.selectInRect(a, b, additive);
      },
    );
  };

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[floor.width / 2, 0, floor.length / 2]}
        onPointerDown={onPointerDown}
      >
        <planeGeometry args={[floor.width, floor.length]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={box} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.2} depthTest={false} />
      </mesh>
    </>
  );
}

/** Accepts library drags on the canvas and places the type under the cursor. */
export function LibraryDropTarget() {
  const gl = useThree((s) => s.gl);
  const getThree = useThree((s) => s.get);
  useEffect(() => {
    const dom = gl.domElement;
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(EQUIPMENT_DRAG_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const drop = (e: DragEvent) => {
      const typeId = e.dataTransfer?.getData(EQUIPMENT_DRAG_TYPE);
      if (!typeId) return;
      e.preventDefault();
      const p = floorPoint(e, dom, getThree().camera);
      if (!p) return;
      const placed = useEditorStore.getState().placeEquipment(typeId, p);
      if (placed) useEditorStore.getState().selectEquipment(placed.id, false);
    };
    dom.addEventListener('dragover', over);
    dom.addEventListener('drop', drop);
    return () => {
      dom.removeEventListener('dragover', over);
      dom.removeEventListener('drop', drop);
    };
  }, [gl, getThree]);
  return null;
}
