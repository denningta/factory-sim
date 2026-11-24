import { useState } from 'react';
import type { User } from '@factory-sim/schema';
import { api } from '../api/client';

/** Sign-in, or first-admin setup while the instance has no users (PL-6 routes). */
export function SignIn({
  needsSetup,
  onSignedIn,
  compact = false,
}: {
  needsSetup: boolean;
  onSignedIn: (u: User) => void;
  /** Inside a dialog: no page margins or big heading, and the email field takes focus. */
  compact?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try {
      onSignedIn(await (needsSetup ? api.setup : api.login)(email, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{
        maxWidth: 360,
        margin: compact ? 0 : '80px auto',
        font: '14px sans-serif',
        display: 'grid',
        gap: 8,
      }}
    >
      <h1 style={compact ? { fontSize: 16, margin: 0 } : undefined}>
        {needsSetup ? 'Create the admin account' : 'Sign in'}
      </h1>
      <label>
        Email{' '}
        <input
          type="email"
          autoFocus={compact}
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password{' '}
        <input
          type="password"
          required
          autoComplete={needsSetup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {needsSetup && <small>Use at least 12 characters.</small>}
      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
      <button type="submit">{needsSetup ? 'Create account' : 'Sign in'}</button>
    </form>
  );
}
