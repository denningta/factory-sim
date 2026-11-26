import { useEffect, useMemo } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Connection, Equipment, PortRef } from '@factory-sim/schema';
import type { RunSession } from '../simulation/runSession';
import { connectionLook } from '../simulation/callouts';
import { getTheme, useTheme } from '../ui/themeStore';
import {
  ARC_CLEARANCE,
  ARC_PERIOD,
  buildArcs,
  connectionAtVertex,
  paintArcs,
  type ArcInput,
  type ArcRange,
} from './connectionArcs';
import { useLayersStore } from './layersStore';
import { portWorldPosition } from './ports';

/** Height of a port marker above its equipment; the arc starts and ends at the marker. */
export const PORT_LIFT = 0.1;
const FLOW_SPEED = 1.1; // m/s

let mounted: { geometry: THREE.BufferGeometry; ranges: ArcRange[] } | null = null;
/** Test hook: the colour (hex, no #) and flow flag currently painted on a connection's arc. */
export function arcLook(id: string): { color: string; flowing: boolean } | undefined {
  const r = mounted?.ranges.find((q) => q.id === id);
  const attr = mounted?.geometry.getAttribute('color');
  if (!r || !attr) return undefined;
  const color = new THREE.Color().fromBufferAttribute(attr, r.start).getHexString();
  return { color, flowing: attr.getW(r.start) > 0 };
}

function dashTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Soft-edged dash: bright head fading to nothing, so the direction reads.
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 4);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function arcInputs(
  equipment: readonly Equipment[],
  connections: readonly Connection[],
): ArcInput[] {
  const end = (ref: PortRef) => {
    const e = equipment.find((q) => q.id === ref.equipmentId);
    const port = e?.ports.find((p) => p.id === ref.portId);
    if (!e || !port) return null;
    const at = portWorldPosition(e, port);
    return { e, p: { x: at.x, y: e.height + PORT_LIFT, z: at.y } };
  };
  const out: ArcInput[] = [];
  for (const c of connections) {
    const a = end(c.from);
    const b = end(c.to);
    if (!a || !b || Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z) < 1e-6) continue;
    out.push({
      id: c.id,
      from: a.p,
      to: b.p,
      top: Math.max(a.e.height, b.e.height) + ARC_CLEARANCE,
    });
  }
  return out;
}

/** Per-frame paint and dash scroll for a run. Its own component so the editor has no frame hook. */
function FlowDriver({
  session,
  connections,
  built,
  texture,
}: {
  session: RunSession;
  connections: readonly Connection[];
  built: { geometry: THREE.BufferGeometry; ranges: ArcRange[] };
  texture: THREE.Texture;
}) {
  useFrame((_, delta) => {
    const t = getTheme();
    const states = session.stationStates();
    const looks = new Map<string, { color: string; flowing: boolean }>();
    for (const c of connections) {
      const look = connectionLook(states.get(c.from.equipmentId), session.playing);
      looks.set(c.id, {
        color: look.kind === 'blocked' ? t.state.blocked.strong : t.color.accent,
        flowing: look.flowing,
      });
    }
    paintArcs(built.geometry, built.ranges, looks);
    if (session.playing) texture.offset.x -= (FLOW_SPEED / ARC_PERIOD) * Math.min(delta, 0.1);
  });

  return null;
}

/**
 * Connections as arcs above the line, from output port to input port with an arrowhead. One
 * geometry and one or two draw calls however many there are. The editor passes `selectedId` and
 * `onPick`; Simulate passes `session` and the arcs take its flow and blocked colours.
 */
export function ConnectionArcs({
  equipment,
  connections,
  session,
  selectedId = null,
  onPick,
}: {
  equipment: readonly Equipment[];
  connections: readonly Connection[];
  session?: RunSession;
  selectedId?: string | null;
  onPick?: (id: string) => void;
}) {
  const visible = useLayersStore((s) => s.connections);
  const theme = useTheme();
  const built = useMemo(
    () => buildArcs(arcInputs(equipment, connections)),
    [equipment, connections],
  );
  const mats = useMemo(() => {
    const texture = dashTexture();
    // The solid core carries the colour; the dashes add light on top of it while flowing.
    const core = new THREE.MeshBasicMaterial({ vertexColors: true });
    const flow = new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    return { texture, core, flow };
  }, []);
  useEffect(
    () => () => {
      mats.texture.dispose();
      mats.core.dispose();
      mats.flow.dispose();
    },
    [mats],
  );
  useEffect(() => () => built.geometry.dispose(), [built]);
  useEffect(() => {
    if (!visible) return;
    mounted = built;
    return () => {
      if (mounted === built) mounted = null;
    };
  }, [built, visible]);

  // Editor colouring (also the first paint of a run): the selected connection is the accent.
  useEffect(() => {
    const looks = new Map(
      built.ranges.map((r) => [
        r.id,
        { color: r.id === selectedId ? theme.color.accent : theme.scene.flow, flowing: false },
      ]),
    );
    if (!session) paintArcs(built.geometry, built.ranges, looks);
  }, [built, selectedId, theme, session]);

  if (!visible || built.ranges.length === 0) return null;
  const pick = onPick
    ? (e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0 || !e.face) return;
        const id = connectionAtVertex(built.ranges, e.face.a);
        if (!id) return;
        e.stopPropagation();
        onPick(id);
      }
    : undefined;
  return (
    <>
      <mesh geometry={built.geometry} material={mats.core} onPointerDown={pick} />
      {session && (
        <FlowDriver
          session={session}
          connections={connections}
          built={built}
          texture={mats.texture}
        />
      )}
      {session && <mesh geometry={built.geometry} material={mats.flow} raycast={() => null} />}
    </>
  );
}
