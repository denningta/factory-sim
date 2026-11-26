import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import * as THREE from 'three';
import type { StationState } from '@factory-sim/sim-engine';
import { dark } from '../ui/tokens';
import { realLine } from './testLine';
import type { RunSession } from './runSession';
import { useLayersStore } from '../layout/layersStore';

const frames: ((state: unknown, delta: number) => void)[] = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frames.push(cb);
  },
}));

import { ConnectionArcs, arcLook } from '../layout/ConnectionArcs';

const hex = (c: string) => new THREE.Color(c).getHexString();

afterEach(() => useLayersStore.setState({ connections: true }));

describe('UI-5 AC4 / SF-3 AC3: run connections on the arcs', () => {
  it('draw accent with flow normally, and blocked colour without flow when the upstream is blocked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { project } = realLine();
    const conn = project.connections[1]!; // station → sink
    const states = new Map<string, StationState>();
    const session = { playing: true, stationStates: () => states } as unknown as RunSession;
    render(
      <ConnectionArcs
        session={session}
        equipment={project.equipment}
        connections={project.connections}
      />,
    );
    const tick = () => act(() => frames.forEach((cb) => cb({}, 0.016)));
    tick();
    expect(arcLook(conn.id)).toEqual({ color: hex(dark.color.accent), flowing: true });

    states.set(conn.from.equipmentId, 'blocked');
    tick();
    expect(arcLook(conn.id)).toEqual({ color: hex(dark.state.blocked.strong), flowing: false });
  });

  it('SF-3 AC4: draws nothing while the Connections layer is off', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { project } = realLine();
    const conn = project.connections[0]!;
    useLayersStore.setState({ connections: false });
    render(<ConnectionArcs equipment={project.equipment} connections={project.connections} />);
    expect(arcLook(conn.id)).toBeUndefined();
  });

  it('SF-3 AC2: the selected connection uses the accent colour, others the flow colour', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { project } = realLine();
    const [a, b] = project.connections;
    render(
      <ConnectionArcs
        equipment={project.equipment}
        connections={project.connections}
        selectedId={a!.id}
      />,
    );
    expect(arcLook(a!.id)?.color).toBe(hex(dark.color.accent));
    expect(arcLook(b!.id)?.color).toBe(hex(dark.scene.flow));
  });
});
