import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BASE_EQUIPMENT_TYPES,
  createProject,
  instantiate,
  type Equipment,
} from '@factory-sim/schema';
import { api, ApiRequestError } from '../api/client';
import { useEditorStore } from '../layout/editorStore';
import { ProjectEditor } from './ProjectEditor';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../Editor', () => ({ Editor: () => <div>layout screen</div> }));
vi.mock('../products/ProductsPanel', () => ({ ProductsPanel: () => <div>products screen</div> }));
vi.mock('../simulation/SimulateScreen', () => ({
  SimulateScreen: ({ playRequest }: { playRequest?: boolean }) => (
    <div>simulate screen {playRequest ? 'playing' : 'idle'}</div>
  ),
}));

const ws = BASE_EQUIPMENT_TYPES.find((t) => t.id === 'base-workstation')!;
const station = (id: string, x: number): Equipment => ({
  ...instantiate(ws, { id, name: id, position: { x, y: 0 } }),
  footprint: { width: 2, length: 1 },
});

beforeEach(() => {
  location.hash = '#/p/p1';
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  vi.spyOn(api, 'getProject').mockResolvedValue({
    id: 'p1',
    name: 'Line',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 3,
    document: createProject(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tabs = async () => within(await screen.findByRole('tablist', { name: 'Screens' }));
const product = {
  id: 'p',
  partNumber: 'P',
  name: 'P',
  color: '#000000',
  routing: [{ id: 's0', stationId: 'a' }],
};

describe('UI-2 AC1: top bar', () => {
  it('shows the mark, projects link, name, tabs in order, status and a primary Run button', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    const t = await tabs();
    // An empty project has one open problem (no products), so that tab also carries a badge.
    expect(t.getAllByRole('tab').map((x) => x.firstChild?.textContent?.trim())).toEqual([
      'Layout',
      'Products & routings',
      'Simulate',
      'Results',
    ]);
    expect(screen.getByText('Flow Simulator')).toBeTruthy();
    expect(screen.getByRole('button', { name: '← Projects' })).toBeTruthy();
    expect(screen.getByText('Line')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('All changes saved');
    expect(screen.getByRole('button', { name: 'Run simulation' })).toBeTruthy();
  });
});

describe('UI-2 AC2: Run simulation', () => {
  it('is disabled while pre-run issues exist, and its description lists them', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    const run = await screen.findByRole('button', { name: 'Run simulation' });
    expect(run).toHaveProperty('disabled', true);
    const desc = document.getElementById(run.getAttribute('aria-describedby') ?? '');
    expect(desc?.textContent).toContain('at least one product');
  });
  it('opens Simulate and starts playback when there are no issues', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await screen.findByRole('button', { name: 'Run simulation' });
    useEditorStore.setState({
      equipment: [station('a', 0)],
      products: [product],
      cycleTimes: [
        { productId: 'p', stationId: 'a', time: { kind: 'fixed', seconds: 10 } },
      ] as never,
      technicians: [{ id: 't', name: 'T', stationIds: ['a'] }] as never,
    });
    const run = screen.getByRole('button', { name: 'Run simulation' });
    await waitFor(() => expect(run).toHaveProperty('disabled', false));
    await userEvent.click(run);
    expect(await screen.findByText('simulate screen playing')).toBeTruthy();
    expect(location.hash).toBe('#/p/p1/simulate');
  });
});

describe('UI-2 AC3: badges update when the cause is fixed', () => {
  it('Layout badge counts an overlap and clears when moved apart; Products badge clears when fixed', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    const t = await tabs();
    expect(t.getByRole('tab', { name: /^Layout$/ })).toBeTruthy(); // no badge at 0
    useEditorStore.setState({
      equipment: [station('a', 0), station('b', 1)],
      products: [{ ...product, routing: [] }],
    });
    expect(await t.findByRole('tab', { name: /^Layout 1 open problem$/ })).toBeTruthy();
    useEditorStore.setState({ equipment: [station('a', 0), station('b', 10)] });
    expect(await t.findByRole('tab', { name: /^Layout$/ })).toBeTruthy();
    useEditorStore.setState({ products: [product] });
    expect(
      await t.findByRole('tab', { name: /^Products & routings 1 open problem$/ }),
    ).toBeTruthy();
  });
});

describe('UI-2 AC4: tab in the URL', () => {
  it('opens the tab named in the hash and writes the hash when switching', async () => {
    location.hash = '#/p/p1/products';
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    expect(await screen.findByText('products screen')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(location.hash).toBe('#/p/p1');
    expect(await screen.findByText('layout screen')).toBeTruthy();
  });
});

describe('UI-2 AC4: Back keeps the screen', () => {
  it('follows the hash when it changes after mount', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    expect(await screen.findByText('layout screen')).toBeTruthy();
    act(() => {
      location.hash = '#/p/p1/results';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByText('Run a simulation to see results')).toBeTruthy();
    act(() => {
      location.hash = '#/p/p1';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByText('layout screen')).toBeTruthy();
  });
});

describe('UI-2 AC5: Results tab', () => {
  it('shows an empty state until UI-6', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Results' }));
    expect(screen.getByText('Run a simulation to see results')).toBeTruthy();
  });
});

describe('UI-2 AC6: save status uses Badge tones', () => {
  it('shows the status text inside a badge', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    const status = await screen.findByRole('status');
    expect(status.className).toMatch(/badge/);
    expect(status.className).toMatch(/muted/); // saved
  });
  it('unsaved is neutral, a conflict is danger', async () => {
    vi.spyOn(api, 'updateProject').mockRejectedValue(new ApiRequestError('conflict', 'Changed'));
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await screen.findByRole('status');
    useEditorStore.getState().setClearance(0.5);
    await waitFor(() => expect(screen.getByRole('status').className).toMatch(/neutral/));
    await waitFor(() => expect(screen.getByRole('status').className).toMatch(/danger/), {
      timeout: 5000,
    });
  });
  it('the theme toggle is in the top bar', async () => {
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: /theme/i })).toBeTruthy();
  });
});
