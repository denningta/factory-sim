import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { PortRef } from '@factory-sim/schema';
import { useEditorStore } from './editorStore';
import { PortMarker } from './PortMarker';
import { portKey, portVisual, validInputKeys } from './portMarkers';
import { ConnectionArcs, PORT_LIFT } from './ConnectionArcs';
import { hideDragged, portWorldPosition } from './ports';

/** Connection arcs and the clickable port markers that start them. */
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
  const connected = useMemo(
    () => new Set(connections.flatMap((c) => [portKey(c.from), portKey(c.to)])),
    [connections],
  );
  const valid = useMemo(
    () => validInputKeys(equipment, connections, pending),
    [equipment, connections, pending],
  );

  const onPort = (ref: PortRef) => (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useEditorStore.getState().clickPort(ref);
  };

  return (
    <>
      <ConnectionArcs
        equipment={equipment}
        connections={connections}
        selectedId={selectedId}
        onPick={(id) => useEditorStore.getState().selectConnection(id)}
      />
      {equipment.flatMap((e) =>
        e.ports.map((p) => {
          const at = portWorldPosition(e, p);
          const ref = { equipmentId: e.id, portId: p.id };
          const key = portKey(ref);
          const active = pending?.equipmentId === e.id && pending.portId === p.id;
          return (
            <PortMarker
              key={key}
              // Above the equipment top so the equipment's own pick handler can't swallow the click.
              position={[at.x, e.height + PORT_LIFT, at.y]}
              name={`port:${e.id}:${p.id}`}
              kind={p.kind}
              active={active}
              onPointerDown={onPort(ref)}
              visual={(hovered) =>
                portVisual({
                  kind: p.kind,
                  connected: connected.has(key),
                  hovered,
                  pending,
                  active,
                  valid: valid.has(key),
                })
              }
            />
          );
        }),
      )}
    </>
  );
}
