import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Connection, Equipment } from '@factory-sim/schema';
import { portWorldPosition } from '../layout/ports';
import { connectionLook } from './callouts';
import type { RunSession } from './runSession';
import { getTheme } from '../ui/themeStore';

const Y = 0.1;
type Mats = {
  flow: THREE.MeshBasicMaterial;
  glow: THREE.MeshBasicMaterial;
  core: THREE.MeshBasicMaterial;
};
const registry = new Map<string, Mats>();
/** Test hook: the materials of a mounted connection line. */
export const connectionMaterials = (connectionId: string) => registry.get(connectionId);
const WIDTH = 0.16;
const GLOW_WIDTH = 0.5;
/** Pattern length (m) and flow speed (m/s). */
const PERIOD = 0.9;
const FLOW_SPEED = 1.1;

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

function Line({
  session,
  from,
  to,
  fromId,
  id,
}: {
  session: RunSession;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromId: string;
  id: string;
}) {
  const dx = to.x - from.x;
  const dz = to.y - from.y;
  const len = Math.hypot(dx, dz);
  const parts = useMemo(() => {
    const texture = dashTexture();
    texture.repeat.set(Math.max(1, len / PERIOD), 1);
    const flow = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const glow = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const core = new THREE.MeshBasicMaterial();
    const plane = (w: number) => new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2);
    return {
      texture,
      flow,
      glow,
      core,
      coreG: plane(WIDTH * 0.35),
      flowG: plane(WIDTH),
      glowG: plane(GLOW_WIDTH),
    };
  }, [len]);
  useEffect(() => {
    registry.set(id, parts);
    return () => void registry.delete(id);
  }, [id, parts]);
  useEffect(
    () => () => {
      parts.texture.dispose();
      for (const o of [parts.flow, parts.glow, parts.core, parts.coreG, parts.flowG, parts.glowG])
        o.dispose();
    },
    [parts],
  );
  useFrame((_, delta) => {
    const t = getTheme();
    const look = connectionLook(session.stationStates().get(fromId), session.playing);
    const color = look.kind === 'blocked' ? t.state.blocked.strong : t.color.accent;
    parts.core.color.set(color);
    parts.glow.color.set(color);
    parts.flow.color.set(color);
    // The dashes only show while flowing; a blocked or paused line is the steady core and glow.
    parts.flow.opacity = look.flowing ? 1 : 0;
    if (look.flowing) parts.texture.offset.x -= (FLOW_SPEED / PERIOD) * Math.min(delta, 0.1);
  });
  if (len < 1e-6) return null;
  return (
    <group
      position={[(from.x + to.x) / 2, Y, (from.y + to.y) / 2]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
    >
      <mesh geometry={parts.glowG} material={parts.glow} />
      <mesh position={[0, 0.005, 0]} geometry={parts.coreG} material={parts.core} />
      <mesh position={[0, 0.01, 0]} geometry={parts.flowG} material={parts.flow} />
    </group>
  );
}

/** Glowing connection lines for the simulation: accent while flowing, blocked colour when the upstream station is blocked. */
export function RunConnections({
  session,
  equipment,
  connections,
}: {
  session: RunSession;
  equipment: readonly Equipment[];
  connections: readonly Connection[];
}) {
  const point = (ref: { equipmentId: string; portId: string }) => {
    const e = equipment.find((q) => q.id === ref.equipmentId);
    const port = e?.ports.find((p) => p.id === ref.portId);
    return e && port ? portWorldPosition(e, port) : null;
  };
  return (
    <>
      {connections.map((c) => {
        const a = point(c.from);
        const b = point(c.to);
        return a && b ? (
          <Line
            key={c.id}
            session={session}
            from={a}
            to={b}
            fromId={c.from.equipmentId}
            id={c.id}
          />
        ) : null;
      })}
    </>
  );
}
