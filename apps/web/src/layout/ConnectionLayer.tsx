import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Equipment, PortRef } from '@factory-sim/schema';
import { useEditorStore } from './editorStore';
import { useTheme } from '../ui/themeStore';
import { hideDragged, portWorldPosition } from './ports';

const ARROW_Y = 0.08;
const PORT_LIFT = 0.1;

function portPoint(equipment: readonly Equipment[], ref: PortRef) {
  const e = equipment.find((q) => q.id === ref.equipmentId);
  const port = e?.ports.find((p) => p.id === ref.portId);
  return e && port ? portWorldPosition(e, port) : null;
}

/** One arrow: a thin box along the line plus a cone head at the destination. */
function Arrow({
  from,
  to,
  color,
  onPick,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  onPick?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const dx = to.x - from.x;
  const dz = to.y - from.y;
  const len = Math.hypot(dx, dz);
  const head = Math.min(0.6, len / 2);
  const q = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(dx, 0, dz).normalize(),
      ),
    [dx, dz],
  );
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uz = dz / len;
  const shaft = len - head;
  return (
    <group onPointerDown={onPick}>
      <mesh
        position={[from.x + (ux * shaft) / 2, ARROW_Y, from.y + (uz * shaft) / 2]}
        quaternion={q}
      >
        {/* Wide enough to click; a hairline would be near impossible to hit. */}
        <boxGeometry args={[0.12, shaft, 0.12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[to.x - (ux * head) / 2, ARROW_Y, to.y - (uz * head) / 2]} quaternion={q}>
        <coneGeometry args={[0.25, head, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Connection arrows and the clickable port markers that draw them. */
export function ConnectionLayer() {
  const allEquipment = useEditorStore((s) => s.equipment);
  const allConnections = useEditorStore((s) => s.connections);
  const draggingIds = useEditorStore((s) => s.draggingIds);
  const { equipment, connections } = useMemo(
    () => hideDragged(allEquipment, allConnections, draggingIds),
    [allEquipment, allConnections, draggingIds],
  );
  const selectedId = useEditorStore((s) => s.selectedConnectionId);
  const pending = useEditorStore((s) => s.pendingFrom);
  const theme = useTheme();

  const onPort = (ref: PortRef) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useEditorStore.getState().clickPort(ref);
  };

  return (
    <>
      {connections.map((c) => {
        const a = portPoint(equipment, c.from);
        const b = portPoint(equipment, c.to);
        if (!a || !b) return null;
        return (
          <Arrow
            key={c.id}
            from={a}
            to={b}
            color={c.id === selectedId ? theme.color.accent : theme.scene.flow}
            onPick={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              useEditorStore.getState().selectConnection(c.id);
            }}
          />
        );
      })}
      {equipment.flatMap((e) =>
        e.ports.map((p) => {
          const at = portWorldPosition(e, p);
          const ref = { equipmentId: e.id, portId: p.id };
          const active = pending?.equipmentId === e.id && pending.portId === p.id;
          return (
            <mesh
              key={`${e.id}:${p.id}`}
              // Above the equipment top so the equipment's own pick handler can't swallow the click.
              position={[at.x, e.height + PORT_LIFT, at.y]}
              renderOrder={3}
              onPointerDown={onPort(ref)}
              name={`port:${e.id}:${p.id}`}
            >
              <sphereGeometry args={[0.28, 16, 12]} />
              <meshBasicMaterial
                depthTest={false}
                color={
                  active
                    ? theme.color.warning
                    : p.kind === 'output'
                      ? theme.state.working.strong
                      : theme.state.blocked.strong
                }
              />
            </mesh>
          );
        }),
      )}
    </>
  );
}
