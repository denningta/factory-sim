import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../layout/editorStore';
import { buildLineGeometry } from './partTracks';
import { createTechTracks } from './techTracks';
import { figureTriangleCount, limbAngles, techColor } from './techFigure';
import { dark, light } from '../ui/tokens';

/** One bench, two stations 12 m apart, `n` techs all assigned to the first bench. */
function setup(n: number) {
  const store = createEditorStore();
  const s = store.getState;
  const a = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const b = s().placeEquipment('base-workstation', { x: 18, y: 0 })!;
  for (let i = 0; i < n; i++) {
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, a.id, true);
  }
  const st = s();
  const geometry = buildLineGeometry(st.equipment, st.connections);
  const techs = st.technicians.map((t) => ({
    id: t.id,
    name: t.name,
    homeId: t.stationIds[0],
    stationIds: t.stationIds,
  }));
  const bench = st.equipment.find((e) => e.id === a.id)!;
  return { geometry, techs, a, b, bench };
}

/** Is a plan point inside the equipment's rotated footprint rectangle? */
function inside(
  e: {
    position: { x: number; y: number };
    rotation: number;
    footprint: { width: number; length: number };
  },
  p: { x: number; z: number },
) {
  const dx = p.x - e.position.x;
  const dz = p.z - e.position.y;
  const c = Math.cos(e.rotation);
  const sn = Math.sin(e.rotation);
  const lx = dx * c + dz * sn;
  const lz = -dx * sn + dz * c;
  return Math.abs(lx) < e.footprint.width / 2 && Math.abs(lz) < e.footprint.length / 2;
}

describe('SF-2: technician colours', () => {
  it('distinct techs get distinct, run-stable vest colours from the theme palette', () => {
    for (const theme of [dark, light]) {
      const cols = [0, 1, 2, 3].map((i) => techColor(theme.scene.techs, i));
      expect(new Set(cols).size).toBe(4);
      expect(cols).toEqual([0, 1, 2, 3].map((i) => techColor(theme.scene.techs, i)));
      expect(
        theme.scene.techs.every((c) => !Object.values(theme.state).some((s) => s.strong === c)),
      ).toBe(true);
    }
    const { geometry, techs } = setup(3);
    expect(
      createTechTracks(geometry, techs)
        .at(0)
        .map((p) => p.order),
    ).toEqual([0, 1, 2]);
  });
});

describe('SF-2: technician figure at the bench', () => {
  it('AC1: a figure is within 1,500 triangles', () => {
    expect(figureTriangleCount()).toBeGreaterThan(100);
    expect(figureTriangleCount()).toBeLessThanOrEqual(1500);
  });

  it('AC2: at a station the tech stands outside the bench, facing it, arms forward', () => {
    const { geometry, techs, a, bench } = setup(1);
    const pose = createTechTracks(geometry, techs).at(0)[0]!;
    expect(pose.state).toBe('standing');
    expect(inside(bench, pose)).toBe(false);
    const g = geometry.equipment.get(a.id)!;
    expect([pose.x, pose.z]).toEqual([g.operator.x, g.operator.z]);
    // Facing: the heading points from the tech toward the bench center.
    const toBench = { x: g.center.x - pose.x, z: g.center.z - pose.z };
    const len = Math.hypot(toBench.x, toBench.z);
    expect(Math.sin(pose.heading)).toBeCloseTo(toBench.x / len, 6);
    expect(Math.cos(pose.heading)).toBeCloseTo(toBench.z / len, 6);
    // Working pose: both arms raised well forward.
    const arms = limbAngles(pose);
    expect(arms.armL).toBeGreaterThan(1);
    expect(arms.armR).toBeGreaterThan(1);
  });

  it('AC3: walking, the tech faces its direction of travel with arms down and a stepping cycle', () => {
    const { geometry, techs, a, b } = setup(1);
    // Hand-feed one walk from bench A to bench B.
    const tracks = createTechTracks(geometry, techs);
    tracks.ingest([
      { type: 'techMoved', t: 10, techId: techs[0]!.id, fromId: a.id, toId: b.id, arrivesAt: 20 },
    ] as never);
    const from = geometry.equipment.get(a.id)!.operator;
    const to = geometry.equipment.get(b.id)!.operator;
    const mid = tracks.at(15)[0]!;
    expect(mid.state).toBe('walking');
    expect(Math.sin(mid.heading)).toBeCloseTo(
      (to.x - from.x) / Math.hypot(to.x - from.x, to.z - from.z),
      6,
    );
    expect(Math.cos(mid.heading)).toBeCloseTo(
      (to.z - from.z) / Math.hypot(to.x - from.x, to.z - from.z),
      6,
    );
    expect(mid.walked).toBeGreaterThan(0);
    const l = limbAngles(mid);
    expect(Math.abs(l.armL)).toBeLessThan(0.7);
    // Legs alternate, and the cycle moves with the distance walked (so with the sim clock).
    expect(l.legL).toBeCloseTo(-l.legR, 9);
    const later = limbAngles(tracks.at(15.4)[0]!);
    expect(later.legL).not.toBeCloseTo(l.legL, 3);
    // Same sim time, same pose: nothing depends on wall time.
    expect(limbAngles(tracks.at(15)[0]!)).toEqual(l);
  });

  it('AC4: two or more techs at one bench stand side by side outside the footprint', () => {
    const { geometry, techs, bench } = setup(3);
    const poses = createTechTracks(geometry, techs).at(0);
    expect(poses).toHaveLength(3);
    for (const p of poses) expect(inside(bench, p)).toBe(false);
    for (let i = 0; i < poses.length; i++)
      for (let j = i + 1; j < poses.length; j++)
        expect(Math.hypot(poses[i]!.x - poses[j]!.x, poses[i]!.z - poses[j]!.z)).toBeGreaterThan(
          0.5,
        );
    // Along the front edge: same offset from the bench in its own frame, different positions along it.
    const local = poses.map((p) => {
      const dx = p.x - bench.position.x;
      const dz = p.z - bench.position.y;
      const c = Math.cos(bench.rotation);
      const sn = Math.sin(bench.rotation);
      return { x: dx * c + dz * sn, z: -dx * sn + dz * c };
    });
    for (const l of local) expect(l.z).toBeCloseTo(local[0]!.z, 6);
    expect(new Set(local.map((l) => l.x.toFixed(3))).size).toBe(3);
    expect(new Set(poses.map((p) => p.heading.toFixed(6))).size).toBe(1);
  });

  it('AC5: poses are a pure function of sim time, so animation off/on restores them', () => {
    const { geometry, techs } = setup(2);
    const tracks = createTechTracks(geometry, techs);
    const before = tracks.at(0);
    tracks.seed([]);
    tracks.seed(techs.map((t) => ({ techId: t.id, atId: t.homeId }) as never));
    expect(tracks.at(0)).toEqual(before);
    expect(before.map((p) => p.name)).toEqual(techs.map((t) => t.name));
  });
});
