import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { EQUIPMENT_DRAG_TYPE } from '../equipment/LibraryPanel';
import { useEditorStore } from './editorStore';
import { pointerToFloor } from './picking';
import { dragTargets } from './selection';
import { instanceTint } from './instanceTint';
import { findIssues } from './overlaps';
import type { Equipment } from '@factory-sim/schema';
import { useTheme, useThemeStore } from '../ui/themeStore';
import { roleColor, roleMaterial } from '../equipment/models/materials';
import { writePartMatrix } from '../equipment/models/instances';
import { UnitGeometry } from '../equipment/EquipmentModel';
import { groupEquipment, lodForDistance, splitByLod, type EquipmentGroup } from './equipmentGroups';

type Point = { x: number; y: number };

type Group = EquipmentGroup;

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

/** Camera distance (m) to an item's center, for picking its LOD. */
function itemDistance(cam: THREE.Vector3, e: Equipment, at: Point) {
  return Math.hypot(cam.x - at.x, cam.y - e.height / 2, cam.z - at.y);
}

const sameSplit = (a: number[][] | undefined, b: number[][]) =>
  !!a &&
  a.length === b.length &&
  a.every((l, i) => l.length === b[i]!.length && l.every((x, j) => x === b[i]![j]));

/**
 * Placed equipment, one InstancedMesh per (model, LOD, part), whatever the instance sizes or
 * types (ADR-0014, ADR-0015). Each mesh can hold every item of its group; the items at that LOD
 * fill its first `count` slots. Matrices are written imperatively: a drag previews through refs
 * and commits to the store once on release, and a camera move rewrites them only when an item
 * changes LOD, so no React state changes per frame or pointer move.
 */
export function EquipmentLayer() {
  const mode = useThemeStore((s) => s.mode);
  const equipment = useEditorStore((s) => s.equipment);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const gl = useThree((s) => s.gl);
  const getThree = useThree((s) => s.get);
  const meshes = useRef(new Map<string, THREE.InstancedMesh>());
  const stopDrag = useRef<(() => void) | null>(null);
  /** Per group key, the item indices drawn at each LOD. */
  const splits = useRef(new Map<string, number[][]>());
  const preview = useRef<Record<string, Point> | null>(null);

  const clearance = useEditorStore((s) => s.clearance);
  const issues = useMemo(() => findIssues(equipment, clearance), [equipment, clearance]);
  const groups = useMemo(() => groupEquipment(equipment), [equipment]);

  const at = (e: Equipment) => preview.current?.[e.id] ?? e.position;

  /** Recomputes which items draw at which LOD; true if anything changed. */
  const updateSplits = () => {
    const cam = getThree().camera.position;
    let changed = false;
    for (const g of groups) {
      const split = splitByLod(
        g.items.length,
        (i) =>
          lodForDistance(g.model.lodDistances, itemDistance(cam, g.items[i]!, at(g.items[i]!))),
        g.lods.length,
      );
      if (sameSplit(splits.current.get(g.key), split)) continue;
      splits.current.set(g.key, split);
      changed = true;
    }
    return changed;
  };

  /** Writes every instance matrix and tint from the current splits and drag preview. */
  const write = () => {
    const color = new THREE.Color();
    const selected = new Set(useEditorStore.getState().selectedIds);
    for (const g of groups) {
      const split = splits.current.get(g.key);
      if (!split) continue;
      g.lods.forEach((parts, lod) => {
        const slots = split[lod]!;
        parts.forEach((part, pi) => {
          const mesh = meshes.current.get(`${g.key}:${lod}:${pi}`);
          if (!mesh) return;
          slots.forEach((i, slot) => {
            const e = g.items[i]!;
            const p = at(e);
            writePartMatrix(mesh, slot, g.itemLods[i]![lod]![pi]!, { ...p, rotation: e.rotation });
            instanceTint(
              color.set(roleColor(part.role, e.color)),
              {
                overlapping: issues.overlappingIds.has(e.id),
                tooClose: issues.tooCloseIds.has(e.id),
                selected: selected.has(e.id),
              },
              color,
            );
            mesh.setColorAt(slot, color);
          });
          mesh.count = slots.length;
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere(); // keeps picking and culling right after moves
        });
      });
    }
  };

  // Selection only changes tints, but it still needs a rewrite.
  useLayoutEffect(() => {
    splits.current.clear();
    updateSplits();
    write();
  }, [groups, selectedIds, issues, mode]);
  useFrame(() => {
    if (updateSplits()) write();
  });
  useEffect(
    () => () => {
      stopDrag.current?.();
      useEditorStore.getState().setDragging([]);
    },
    [],
  );

  const onPointerDown = (g: Group, lod: number) => (e: ThreeEvent<PointerEvent>) => {
    const i =
      e.instanceId === undefined ? undefined : splits.current.get(g.key)?.[lod]?.[e.instanceId];
    const item = i === undefined ? undefined : g.items[i];
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
    let moving = false;
    stopDrag.current = trackDrag(
      (ev) => {
        const d = deltaOf(ev);
        if (!d) return;
        // Once per drag, not per move: a plain click must not re-render the connection layer.
        if (!moving) {
          moving = true;
          useEditorStore.getState().setDragging(Object.keys(starts));
        }
        preview.current = dragTargets(starts, item.id, d, snap());
        write();
      },
      (ev) => {
        stopDrag.current = null;
        if (moving) useEditorStore.getState().setDragging([]);
        const d = deltaOf(ev);
        preview.current = null;
        if (d) useEditorStore.getState().dragSelected(starts, item.id, d);
        write();
      },
    );
  };

  return (
    <>
      {groups.map((g) =>
        g.lods.map((parts, lod) =>
          parts.map((part, pi) => (
            <instancedMesh
              // Remount when the count changes: an InstancedMesh's capacity is fixed at creation.
              key={`${g.key}:${lod}:${pi}:${g.items.length}`}
              ref={(m: THREE.InstancedMesh | null) => {
                const k = `${g.key}:${lod}:${pi}`;
                if (m) meshes.current.set(k, m);
                else meshes.current.delete(k);
              }}
              args={[undefined, undefined, g.items.length]}
              material={roleMaterial(part.role)}
              onPointerDown={onPointerDown(g, lod)}
            >
              <UnitGeometry part={part} />
            </instancedMesh>
          )),
        ),
      )}
    </>
  );
}

/** Drag on empty floor draws a selection box; a plain click clears the selection. */
export function FloorInteraction() {
  const accent = useTheme().color.accent;
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
        <meshBasicMaterial color={accent} transparent opacity={0.2} depthTest={false} />
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
