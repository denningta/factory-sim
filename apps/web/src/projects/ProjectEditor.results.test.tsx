import type { ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProject, projectSchema } from '@factory-sim/schema';
import { api } from '../api/client';
import { useEditorStore } from '../layout/editorStore';
import { useSessionStore } from '../simulation/sessionStore';
import { ProjectEditor } from './ProjectEditor';
import modelJson from '../../../../docs/reference-model/model.json';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../Editor', () => ({ Editor: () => <div /> }));
vi.mock('../products/ProductsPanel', () => ({ ProductsPanel: () => <div /> }));
vi.mock('../simulation/TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('../simulation/PartLayer', () => ({ PartLayer: () => <div /> }));
vi.mock('../simulation/StationLayer', () => ({ StationLayer: () => <div /> }));

const document = projectSchema.parse(modelJson);
const mockProject = (id: string, doc = document) =>
  vi.spyOn(api, 'getProject').mockResolvedValue({
    id,
    name: 'Line',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    document: doc,
  });

beforeEach(() => {
  location.hash = '';
  useSessionStore.setState({ count: 0, current: null });
  useEditorStore.setState(useEditorStore.getInitialState(), true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tab = (name: string) => screen.findByRole('tab', { name });
const selected = (name: string) =>
  screen.getByRole('tab', { name }).getAttribute('aria-selected') === 'true';
const number = () => useSessionStore.getState().current?.number;

/** Finishes the current run so the figures (and the bottleneck) exist. */
function finishRun() {
  const r = useSessionStore.getState().current!.result;
  if (!r.ok) throw new Error('should run');
  act(() => {
    r.session.runToEnd();
    for (let i = 0; i < 100000 && !r.session.done; i++) r.session.frame(1000);
  });
}

describe('UI-6 AC4: Open in Layout', () => {
  it('switches to Layout with the bottleneck station selected', async () => {
    mockProject('p1');
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await userEvent.click(await tab('Simulate'));
    finishRun();
    await userEvent.click(await tab('Results'));
    await userEvent.click(screen.getByRole('button', { name: /Open in Layout/ }));
    expect(selected('Layout')).toBe(true);
    // S3 Weld is the reference model's constraint (docs/reference-model/README.md).
    expect([...useEditorStore.getState().selectedIds]).toEqual(['s3']);
  });
});

describe('UI-6 AC1: Run simulation and Run again start a new run', () => {
  it('the top-bar Run simulation bumps the run number and lands on Simulate', async () => {
    mockProject('p1');
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await userEvent.click(await tab('Simulate'));
    expect(number()).toBe(1);
    await userEvent.click(await tab('Layout'));
    await userEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    expect(number()).toBe(2);
    expect(selected('Simulate')).toBe(true);
  });

  it('Results → Run again bumps the run number and lands on Simulate', async () => {
    mockProject('p1');
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await userEvent.click(await tab('Simulate'));
    await userEvent.click(await tab('Results'));
    act(() => useEditorStore.getState().setReleaseInterval(45));
    await userEvent.click(await screen.findByRole('button', { name: /run again/i }));
    expect(number()).toBe(2);
    expect(selected('Simulate')).toBe(true);
  });
});

describe('UI-6: a run does not follow you into the next project', () => {
  it('loading a second document leaves Results on the empty state', async () => {
    mockProject('p1');
    const first = render(<ProjectEditor id="p1" onClose={() => {}} />);
    await userEvent.click(await tab('Simulate'));
    expect(number()).toBe(1);
    first.unmount();
    mockProject('p2', createProject());
    location.hash = '#/p/p2/results';
    render(<ProjectEditor id="p2" onClose={() => {}} />);
    expect(await screen.findByText('Run a simulation to see results')).toBeTruthy();
    expect(useSessionStore.getState().count).toBe(0);
  });
});
