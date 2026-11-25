import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Equipment } from '@factory-sim/schema';
import { MIN_TEXT_PX, calloutLines, pixelsPerMeter, resolveOverlaps, type Rect } from './callouts';
import type { RunSession } from './runSession';
import { lightSegments } from './stationStatus';
import { stationUtilization } from './utilization';
import { getTheme } from '../ui/themeStore';

/** Card size in CSS pixels; the canvas is drawn at 2× for sharp text. */
const CARD_W = 176;
const CARD_H = 62;
const SCALE = 2;
/** Gap between the station's top and the card's bottom edge, in pixels. */
const LEADER_PX = 36;
/** Text redraws a few times a second; position and size follow the camera every frame. */
const TEXT_INTERVAL_MS = 250;

interface Card {
  station: Equipment;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  sprite: THREE.Sprite;
  leader: THREE.Line;
  key: string;
}

function draw(card: Card, text: ReturnType<typeof calloutLines>, color: string, accent: boolean) {
  const ctx = card.canvas.getContext('2d');
  if (!ctx) return;
  const t = getTheme();
  const { width, height } = card.canvas;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = t.color.raised;
  ctx.strokeStyle = accent ? t.color.accent : t.color.panelBorder;
  ctx.lineWidth = accent ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(1, 1, CARD_W - 2, CARD_H - 2, t.radius.md);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = t.color.text;
  ctx.font = `600 ${MIN_TEXT_PX + 1}px ${t.font.family}`;
  ctx.fillText(text.title, 10, 17, text.badge ? CARD_W - 96 : CARD_W - 20);
  if (text.badge) {
    ctx.font = `600 ${MIN_TEXT_PX}px ${t.font.family}`;
    const w = ctx.measureText(text.badge).width + 14;
    ctx.fillStyle = t.color.accent;
    ctx.beginPath();
    ctx.roundRect(CARD_W - w - 8, 8, w, 18, 9);
    ctx.fill();
    ctx.fillStyle = t.color.accentInk;
    ctx.fillText(text.badge, CARD_W - w - 1, 17.5);
  }
  ctx.font = `${MIN_TEXT_PX}px ${t.font.family}`;
  ctx.fillStyle = color;
  ctx.fillText(text.state, 10, 59 / 2 + 2);
  ctx.fillStyle = t.color.muted;
  ctx.fillText(text.stats, 10, 49);
  card.texture.needsUpdate = true;
}

/**
 * One callout card per station: a canvas sprite sized in screen pixels (so the text is never
 * below MIN_TEXT_PX at any zoom) with a leader line to the machine. All of it is driven from
 * one frame callback: position, size and overlap every frame, text only a few times a second.
 */
export function StationCallouts({
  session,
  stations,
  bottleneckId,
}: {
  session: RunSession;
  stations: readonly Equipment[];
  bottleneckId: string | null;
}) {
  const cards = useMemo<Card[]>(
    () =>
      stations.map((station) => {
        const canvas = document.createElement('canvas');
        canvas.width = CARD_W * SCALE;
        canvas.height = CARD_H * SCALE;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
        );
        sprite.renderOrder = 10;
        sprite.frustumCulled = false;
        const leader = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
          new THREE.LineBasicMaterial({ color: getTheme().color.panelBorder, depthTest: false }),
        );
        leader.renderOrder = 9;
        leader.frustumCulled = false;
        return { station, canvas, texture, sprite, leader, key: '' };
      }),
    [stations],
  );
  useEffect(
    () => () =>
      cards.forEach((c) => {
        c.texture.dispose();
        c.sprite.material.dispose();
        c.leader.geometry.dispose();
        (c.leader.material as THREE.Material).dispose();
      }),
    [cards],
  );
  const scratch = useMemo(
    () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), lastText: -Infinity }),
    [],
  );

  useFrame(({ camera, size }) => {
    const now = performance.now();
    if (now - scratch.lastText >= TEXT_INTERVAL_MS) {
      scratch.lastText = now;
      const rows = stationUtilization(session.stats(), [...stations]);
      const queues = session.queueLengths();
      const states = session.stationStates();
      for (const card of cards) {
        const id = card.station.id;
        const state = states.get(id);
        const text = calloutLines({
          name: card.station.name,
          state,
          waiting: queues.get(id) ?? 0,
          working: rows.find((r) => r.id === id)?.working ?? 0,
          bottleneck: id === bottleneckId,
        });
        const key = JSON.stringify([text, getTheme().color.accent]);
        if (key === card.key) continue;
        card.key = key;
        const t = getTheme();
        const lit = lightSegments(state, t).find((s) => s.lit);
        draw(card, text, lit?.color ?? t.color.muted, id === bottleneckId);
      }
    }

    const cam: Parameters<typeof pixelsPerMeter>[0] =
      camera instanceof THREE.OrthographicCamera
        ? { kind: 'ortho', zoom: camera.zoom }
        : { kind: 'persp', fovDeg: (camera as THREE.PerspectiveCamera).fov };
    // Screen-space anchors (px, y down), then lift overlapping cards apart.
    const anchors = cards.map((c) => {
      const p = scratch.a.set(c.station.position.x, c.station.height, c.station.position.y);
      const depth = Math.abs(p.clone().applyMatrix4(camera.matrixWorldInverse).z);
      const ndc = p.clone().project(camera);
      return {
        ndc,
        depth,
        sx: ((ndc.x + 1) / 2) * size.width,
        sy: ((1 - ndc.y) / 2) * size.height,
      };
    });
    const rects: Rect[] = anchors.map((a) => ({
      x: a.sx - CARD_W / 2,
      y: a.sy - LEADER_PX - CARD_H,
      w: CARD_W,
      h: CARD_H,
    }));
    const lifts = resolveOverlaps(rects);
    cards.forEach((c, i) => {
      const a = anchors[i]!;
      const ppm = pixelsPerMeter(cam, size.height, a.depth);
      const toWorld = (sx: number, sy: number, out: THREE.Vector3) =>
        out.set((sx / size.width) * 2 - 1, 1 - (sy / size.height) * 2, a.ndc.z).unproject(camera);
      const cardBottom = a.sy - LEADER_PX - lifts[i]!;
      toWorld(a.sx, cardBottom - CARD_H / 2, c.sprite.position);
      c.sprite.scale.set(CARD_W / ppm, CARD_H / ppm, 1);
      toWorld(a.sx, cardBottom, scratch.b);
      const pos = c.leader.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, c.station.position.x, c.station.height, c.station.position.y);
      pos.setXYZ(1, scratch.b.x, scratch.b.y, scratch.b.z);
      pos.needsUpdate = true;
    });
  });

  return (
    <>
      {cards.map((c) => (
        <group key={c.station.id}>
          <primitive object={c.leader} />
          <primitive object={c.sprite} />
        </group>
      ))}
    </>
  );
}
