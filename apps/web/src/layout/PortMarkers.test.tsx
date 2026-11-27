import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import * as THREE from 'three';

const fakeState = {
  camera: new THREE.PerspectiveCamera(45, 1.6, 0.1, 500),
  size: { width: 1280, height: 800 },
  gl: { domElement: document.createElement('canvas') },
};
vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: (sel: (s: unknown) => unknown) => sel(fakeState),
}));

import { PortMarkers, type PortSpot } from './PortMarkers';

afterEach(cleanup);

const spots = (n: number): PortSpot[] =>
  Array.from({ length: n }, (_, i) => ({
    ref: { equipmentId: `e${Math.floor(i / 2)}`, portId: i % 2 ? 'out' : 'in' },
    key: `e${Math.floor(i / 2)}:${i % 2 ? 'out' : 'in'}`,
    kind: i % 2 ? ('output' as const) : ('input' as const),
    position: [i * 2, 1, 0] as [number, number, number],
    active: false,
    valid: false,
    connected: i % 3 === 0,
  }));

describe('SF-8 AC3: port markers are instanced, not two meshes per port', () => {
  it('400 ports draw with a handful of meshes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // jsdom warns about three tags
    const { container } = render(
      <PortMarkers spots={spots(400)} pending={null} onPort={() => {}} />,
    );
    const drawn = container.querySelectorAll('mesh, instancedmesh, sprite').length;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThanOrEqual(4);
  });

  it('draws nothing for a floor without ports', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<PortMarkers spots={[]} pending={null} onPort={() => {}} />);
    expect(container.querySelectorAll('mesh, instancedmesh, sprite').length).toBe(0);
  });
});
