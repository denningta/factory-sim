import { Profiler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import * as THREE from 'three';
import { dark } from '../ui/tokens';
import { createRunSession } from './runSession';
import { realLine } from './testLine';

const frames: ((state: unknown, delta: number) => void)[] = [];
const fakeState = {
  camera: new THREE.PerspectiveCamera(45, 1.6, 0.1, 500),
  size: { width: 1280, height: 800 },
  scene: new THREE.Scene(),
};
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    frames.push(cb);
  },
  useThree: (sel: (s: unknown) => unknown) => sel(fakeState),
}));

import { StationLayer, lightMaterials } from './StationLayer';
import { Legend } from './Legend';

describe('UI-5 AC8: per-frame colour writes go through refs, not React state', () => {
  it('a stationState event changes the light material without re-rendering StationLayer', () => {
    const { project } = realLine();
    const r = createRunSession(project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    const station = project.equipment.find((e) => e.behavior === 'workstation')!;
    let commits = 0;
    spyConsole();
    render(
      <Profiler id="layer" onRender={() => commits++}>
        <StationLayer session={r.session} stations={[station]} />
      </Profiler>,
    );
    const before = commits;
    const mats = lightMaterials(station.id)!;
    expect(mats).toBeDefined();
    for (let i = 0; i < 200 && r.session.stationStates().get(station.id) !== 'working'; i++)
      r.session.step();
    expect(r.session.stationStates().get(station.id)).toBe('working');
    act(() => frames.forEach((cb) => cb(fakeState, 0.016)));
    expect(mats.working.color.getHexString()).toBe(
      new THREE.Color(dark.state.working.strong).getHexString(),
    );
    expect(commits).toBe(before);
  });
});

describe('UI-5 AC5: legend', () => {
  it('lists the five states and the product colours', () => {
    const { getByRole } = render(
      <Legend products={[{ id: 'p', name: 'Widget', color: '#3366ff' }]} />,
    );
    const items = [...getByRole('list', { name: 'Legend' }).querySelectorAll('li')].map(
      (li) => li.textContent,
    );
    expect(items).toEqual([
      'Working',
      'Starved',
      'Blocked',
      'Waiting for tech',
      'Tech walking',
      'Widget',
    ]);
  });
});

function spyConsole() {
  // jsdom renders r3f's lowercase three elements as unknown DOM tags and warns; irrelevant here.
  vi.spyOn(console, 'error').mockImplementation(() => {});
}
