import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProject } from '@factory-sim/schema';
import { api } from '../api/client';
import { useEditorStore } from '../layout/editorStore';
import { ProjectEditor } from './ProjectEditor';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../Editor', () => ({ Editor: () => <div /> }));
vi.mock('../products/ProductsPanel', () => ({ ProductsPanel: () => <div /> }));
vi.mock('../simulation/TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('../simulation/PartLayer', () => ({ PartLayer: () => <div /> }));

beforeEach(() => {
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

describe('SE-7: ProjectEditor saves run settings', () => {
  it('AC2: applying run settings marks the project dirty and saves document.run', async () => {
    const update = vi
      .spyOn(api, 'updateProject')
      .mockResolvedValue({ id: 'p1', name: 'Line', updatedAt: '', revision: 4 });
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Simulate' }));
    await userEvent.clear(screen.getByLabelText('Warm-up (hr)'));
    await userEvent.type(screen.getByLabelText('Warm-up (hr)'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(update).toHaveBeenCalled(), { timeout: 5000 });
    const [id, req] = update.mock.calls[0]!;
    expect(id).toBe('p1');
    expect(req.baseRevision).toBe(3);
    expect(req.document?.run.warmUp).toBe(7200);
  });
});

describe('LE-6: ProjectEditor saves minimum clearance', () => {
  it('changing it marks the project dirty and autosaves layout.minClearance', async () => {
    const update = vi
      .spyOn(api, 'updateProject')
      .mockResolvedValue({ id: 'p1', name: 'Line', updatedAt: '', revision: 4 });
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await screen.findByRole('button', { name: 'Simulate' });
    useEditorStore.getState().setClearance(0.6);
    await waitFor(() => expect(update).toHaveBeenCalled(), { timeout: 5000 });
    expect(update.mock.calls[0]![1].document?.layout.minClearance).toBe(0.6);
  });
});
