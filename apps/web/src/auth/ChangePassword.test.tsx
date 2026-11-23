import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePassword } from './ChangePassword';

afterEach(cleanup);

describe('ChangePassword', () => {
  it('AC1: submits the current and new password and confirms', async () => {
    const changePassword = vi.fn(async () => {});
    render(<ChangePassword api={{ changePassword }} />);
    await userEvent.type(screen.getByLabelText(/current password/i), 'old old old old');
    await userEvent.type(screen.getByLabelText(/new password/i), 'a brand new passphrase');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(changePassword).toHaveBeenCalledWith('old old old old', 'a brand new passphrase');
    expect(await screen.findByText(/password changed/i)).toBeTruthy();
  });

  it('AC1: shows the server error, e.g. a wrong current password', async () => {
    const changePassword = vi.fn(async () => {
      throw new Error('Current password is incorrect');
    });
    render(<ChangePassword api={{ changePassword }} />);
    await userEvent.type(screen.getByLabelText(/current password/i), 'x');
    await userEvent.type(screen.getByLabelText(/new password/i), 'a brand new passphrase');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/incorrect/i));
  });

  it('AC1: the new password field uses new-password and shows the 12-character minimum', () => {
    render(<ChangePassword api={{ changePassword: async () => {} }} />);
    expect(screen.getByLabelText(/new password/i).getAttribute('autocomplete')).toBe(
      'new-password',
    );
    expect(screen.getByText(/at least 12 characters/i)).toBeTruthy();
  });
});
