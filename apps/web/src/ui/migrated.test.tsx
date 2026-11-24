import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectSummary, User } from '@factory-sim/schema';
import { ChangePassword } from '../auth/ChangePassword';
import { SignIn } from '../auth/SignIn';
import { UserAdmin } from '../auth/UserAdmin';
import { createEditorStore } from '../layout/editorStore';
import { ProductsPanel } from '../products/ProductsPanel';
import { ProjectList } from '../projects/ProjectList';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

/** Computed geometry only: bar widths and product colour swatches (ADR-0016). */
const ALLOWED = new Set(['width', 'height', 'background', 'background-color']);
function inlineStyleViolations(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[style]')].flatMap((el) =>
    [...el.style].filter((p) => !ALLOWED.has(p)).map((p) => `${el.tagName.toLowerCase()} ${p}`),
  );
}

const admin: User = { id: 'u1', email: 'a@x.io', role: 'admin', disabled: false } as User;
const other: User = { id: 'u2', email: 'b@x.io', role: 'user', disabled: false } as User;
const project: ProjectSummary = {
  id: 'p1',
  name: 'Line A',
  updatedAt: '2026-03-01T10:00:00.000Z',
  revision: 0,
};

describe('UI-1 AC3: migrated screens carry no hand-written font, colour, border or spacing in style=', () => {
  it('sign-in and first-admin setup', () => {
    for (const needsSetup of [false, true]) {
      const { container, unmount } = render(
        <SignIn needsSetup={needsSetup} onSignedIn={() => {}} />,
      );
      expect(inlineStyleViolations(container)).toEqual([]);
      unmount();
    }
    const { container } = render(<SignIn compact needsSetup={false} onSignedIn={() => {}} />);
    expect(inlineStyleViolations(container)).toEqual([]);
  });

  it('account: change password and user admin', async () => {
    const { container } = render(
      <>
        <ChangePassword api={{ changePassword: vi.fn().mockRejectedValue(new Error('Wrong')) }} />
        <UserAdmin
          api={{ listUsers: async () => [admin, other], resetPassword: vi.fn() }}
          currentUserId={admin.id}
        />
      </>,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /reset password for b@x.io/i }),
    );
    expect(inlineStyleViolations(container)).toEqual([]);
  });

  it('project list, empty and with rows', async () => {
    const api = {
      listProjects: async () => [project],
      createProject: vi.fn(),
      renameProject: vi.fn(),
      deleteProject: vi.fn(),
    };
    const { container, unmount } = render(
      <ProjectList api={api} onOpen={() => {}} onAccount={() => {}} onSignOut={() => {}} />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Rename Line A' }));
    expect(inlineStyleViolations(container)).toEqual([]);
    unmount();
    const empty = render(
      <ProjectList api={{ ...api, listProjects: async () => [] }} onOpen={() => {}} />,
    );
    await screen.findByText(/no projects yet/i);
    expect(inlineStyleViolations(empty.container)).toEqual([]);
  });

  it('products and routings', () => {
    const store = createEditorStore();
    const s = store.getState();
    const saw = s.placeEquipment('base-workstation', { x: 2, y: 2 })!;
    const p1 = s.addProduct();
    s.addProduct();
    s.addRoutingStep(p1.id, saw.id);
    s.setDemandBasis('perShift');
    const { container } = render(<ProductsPanel useStore={store} />);
    expect(container.querySelector('[style]')).not.toBeNull(); // the product colour swatch
    expect(inlineStyleViolations(container)).toEqual([]);
  });
});
