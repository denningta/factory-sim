import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProject } from '@factory-sim/schema';
import { api, ApiRequestError } from '../api/client';
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

describe('SC-2: sign in again without losing edits', () => {
  it('AC1+AC2: an expired session opens a sign-in dialog over the editor; signing in retries the save with no reload', async () => {
    const update = vi
      .spyOn(api, 'updateProject')
      .mockRejectedValueOnce(new ApiRequestError('unauthorized', 'Sign in again'))
      .mockResolvedValue({ id: 'p1', name: 'Line', updatedAt: '', revision: 4 });
    const login = vi.spyOn(api, 'login').mockResolvedValue({
      id: 'u1',
      email: 'a@b.co',
      role: 'admin',
    } as Awaited<ReturnType<typeof api.login>>);
    render(<ProjectEditor id="p1" onClose={() => {}} />);
    await screen.findByRole('button', { name: 'Simulate' });
    useEditorStore.getState().setClearance(0.7);
    const dialog = await screen.findByRole('dialog', undefined, { timeout: 5000 });
    // Editor state is kept, and the project name is still on screen behind the dialog.
    expect(screen.getByText('Line')).toBeTruthy();
    expect(useEditorStore.getState().clearance).toBe(0.7);
    await userEvent.type(within(dialog).getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(within(dialog).getByLabelText(/password/i), 'correct horse battery');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(login).toHaveBeenCalled();
    expect(update.mock.calls[1]![1].document?.layout.minClearance).toBe(0.7);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('All changes saved');
  });
});
