import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@factory-sim/schema';
import { UserAdmin } from './UserAdmin';

afterEach(cleanup);

const user = (id: string, email: string): User => ({
  id,
  email,
  role: 'user',
  disabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const ME = user('00000000-0000-4000-8000-000000000001', 'admin@plant.test');
const ENG = user('00000000-0000-4000-8000-000000000002', 'eng@plant.test');

describe('UserAdmin', () => {
  it('AC2: an admin sets a new password for another user', async () => {
    const resetPassword = vi.fn(async () => {});
    render(
      <UserAdmin api={{ listUsers: async () => [ME, ENG], resetPassword }} currentUserId={ME.id} />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /reset password.*eng@/i }));
    await userEvent.type(screen.getByLabelText(/new password/i), 'a brand new passphrase');
    await userEvent.click(screen.getByRole('button', { name: /^set password$/i }));
    expect(resetPassword).toHaveBeenCalledWith(ENG.id, 'a brand new passphrase');
    expect(await screen.findByText(/password reset for eng@plant.test/i)).toBeTruthy();
  });

  it('AC2: there is no reset action for the admin’s own account', async () => {
    render(
      <UserAdmin
        api={{ listUsers: async () => [ME, ENG], resetPassword: async () => {} }}
        currentUserId={ME.id}
      />,
    );
    await screen.findByText(/eng@plant\.test \(user\)/);
    expect(screen.queryByRole('button', { name: /reset password.*admin@/i })).toBeNull();
  });
});
