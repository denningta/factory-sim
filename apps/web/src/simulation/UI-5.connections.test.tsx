import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import * as THREE from 'three';
import type { StationState } from '@factory-sim/sim-engine';
import { dark } from '../ui/tokens';
import { realLine } from './testLine';
import type { RunSession } from './runSession';

const frames: ((state: unknown, delta: number) => void)[] = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frames.push(cb);
  },
}));

import { RunConnections, connectionMaterials } from './RunConnections';

const hex = (c: string) => new THREE.Color(c).getHexString();

describe('UI-5 AC4: run connections', () => {
  it('draw accent with flow normally, and blocked colour without flow when the upstream is blocked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { project } = realLine();
    const conn = project.connections[1]!; // station → sink
    const states = new Map<string, StationState>();
    const session = { playing: true, stationStates: () => states } as unknown as RunSession;
    render(
      <RunConnections
        session={session}
        equipment={project.equipment}
        connections={project.connections}
      />,
    );
    const tick = () => act(() => frames.forEach((cb) => cb({}, 0.016)));
    tick();
    const m = connectionMaterials(conn.id)!;
    expect(hex(`#${m.core.color.getHexString()}`)).toBe(hex(dark.color.accent));
    expect(m.flow.opacity).toBe(1);

    states.set(conn.from.equipmentId, 'blocked');
    tick();
    expect(m.core.color.getHexString()).toBe(hex(dark.state.blocked.strong));
    expect(m.glow.color.getHexString()).toBe(hex(dark.state.blocked.strong));
    expect(m.flow.opacity).toBe(0);
  });
});
