import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SignIn } from './SignIn';

afterEach(cleanup);

describe('SignIn', () => {
  it('N3: sign-in fields have autocomplete hints and are required', () => {
    render(<SignIn needsSetup={false} onSignedIn={() => {}} />);
    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(email).toHaveProperty('required', true);
    expect(password).toHaveProperty('required', true);
  });

  it('N3: setup uses new-password and shows the 12-character minimum', () => {
    render(<SignIn needsSetup onSignedIn={() => {}} />);
    expect(screen.getByLabelText(/password/i).getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByText(/at least 12 characters/i)).toBeTruthy();
  });
});
