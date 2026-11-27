import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { createRunSession } from './runSession';
import { realLine } from './testLine';
import { pickCalloutStations, MAX_CALLOUTS } from './callouts';

const fakeState = {
  camera: new THREE.PerspectiveCamera(45, 1.6, 0.1, 500),
  size: { width: 1280, height: 800 },
  scene: new THREE.Scene(),
};
vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: (sel: (s: unknown) => unknown) => sel(fakeState),
}));

import { StationLayer } from './StationLayer';

describe('SF-8 AC3: station overlays are instanced, not one mesh set per station', () => {
  it('100 stations draw with a handful of meshes and a bounded number of callout cards', () => {
    const { project } = realLine();
    const base = project.equipment.find((e) => e.behavior === 'workstation')!;
    const stations = Array.from({ length: 100 }, (_, i) => ({
      ...base,
      id: `st-${i}`,
      position: { x: 2 + (i % 10) * 3, y: 2 + Math.floor(i / 10) * 3 },
    }));
    const r = createRunSession(project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    vi.spyOn(console, 'error').mockImplementation(() => {}); // jsdom warns about three tags
    const { container } = render(<StationLayer session={r.session} stations={stations} />);
    const meshes = container.querySelectorAll('mesh, instancedmesh').length;
    const cards = container.querySelectorAll('primitive').length;
    expect(meshes).toBeLessThanOrEqual(8); // 4 stack-light segments, outlines, halo
    expect(cards).toBeLessThanOrEqual(2 * (MAX_CALLOUTS + 1)); // a sprite and a leader per card
  });
});

describe('SF-8: callouts go to the stations nearest the camera, plus the bottleneck', () => {
  const at = (id: string, x: number) => ({ id, x, y: 0, z: 0 });
  const stations = [at('a', 50), at('b', 10), at('c', 30), at('d', 20), at('e', 40)];

  it('keeps every station when there are few', () => {
    expect(pickCalloutStations(stations, { x: 0, y: 5, z: 0 }, null, 10).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('keeps the nearest `limit` stations, nearest first', () => {
    expect(pickCalloutStations(stations, { x: 0, y: 5, z: 0 }, null, 2)).toEqual(['b', 'd']);
  });

  it('always includes the bottleneck, even when it is far away', () => {
    const ids = pickCalloutStations(stations, { x: 0, y: 5, z: 0 }, 'a', 2);
    expect(ids).toHaveLength(3);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});
