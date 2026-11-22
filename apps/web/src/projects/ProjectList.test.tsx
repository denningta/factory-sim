import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProject, type ProjectSummary } from '@factory-sim/schema';
import { ProjectList, type ProjectsApi } from './ProjectList';

afterEach(cleanup);

const summary = (n: number, name: string, updatedAt: string): ProjectSummary => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  name,
  updatedAt,
  revision: 0,
});

function fakeApi(initial: ProjectSummary[]): ProjectsApi {
  let list = initial;
  return {
    listProjects: vi.fn(async () => list),
    createProject: vi.fn(async (name: string) => {
      const p = summary(9, name, '2026-03-01T10:00:00.000Z');
      list = [p, ...list];
      return { ...p, document: createProject() };
    }),
    renameProject: vi.fn(async (p: ProjectSummary, name: string) => {
      list = list.map((x) => (x.id === p.id ? { ...x, name, revision: x.revision + 1 } : x));
      return list.find((x) => x.id === p.id)!;
    }),
    deleteProject: vi.fn(async (id: string) => {
      list = list.filter((x) => x.id !== id);
    }),
  };
}

const A = summary(1, 'Line A', '2026-02-03T15:30:00.000Z');
const B = summary(2, 'Line B', '2026-01-01T08:00:00.000Z');

describe('ProjectList', () => {
  it('AC3: shows each project name and last modified date', async () => {
    render(<ProjectList api={fakeApi([A, B])} onOpen={() => {}} />);
    const row = (await screen.findByText('Line A')).closest('li')!;
    expect(within(row).getByText(new Date(A.updatedAt).toLocaleString())).toBeTruthy();
    expect(screen.getByText('Line B')).toBeTruthy();
  });

  it('AC1: create adds a project and opens it', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<ProjectList api={fakeApi([A])} onOpen={onOpen} />);
    await screen.findByText('Line A');
    await user.type(screen.getByLabelText(/new project name/i), 'Fresh line');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(onOpen).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000009');
  });

  it('AC1: open calls onOpen with the project id', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<ProjectList api={fakeApi([A])} onOpen={onOpen} />);
    await user.click(await screen.findByRole('button', { name: /open line a/i }));
    expect(onOpen).toHaveBeenCalledWith(A.id);
  });

  it('AC1: rename updates the name shown', async () => {
    const api = fakeApi([A]);
    const user = userEvent.setup();
    render(<ProjectList api={api} onOpen={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /rename line a/i }));
    const input = screen.getByLabelText(/project name/i);
    await user.clear(input);
    await user.type(input, 'Line Z{Enter}');
    expect(await screen.findByText('Line Z')).toBeTruthy();
    expect(api.renameProject).toHaveBeenCalledWith(A, 'Line Z');
  });

  it('AC1: delete asks for confirmation, then removes the project', async () => {
    const api = fakeApi([A, B]);
    const user = userEvent.setup();
    render(<ProjectList api={api} onOpen={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /delete line a/i }));
    expect(api.deleteProject).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    await vi.waitFor(() => expect(screen.queryByText('Line A')).toBeNull());
    expect(api.deleteProject).toHaveBeenCalledWith(A.id);
  });
});
