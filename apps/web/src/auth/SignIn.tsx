import { useState } from 'react';
import type { User } from '@factory-sim/schema';
import { api } from '../api/client';
import { Button, Field } from '../ui';
import styles from './auth.module.css';

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
      className={compact ? styles.formCompact : styles.form}
    >
      <h1 className={compact ? styles.titleCompact : styles.title}>
        {needsSetup ? 'Create the admin account' : 'Sign in'}
      </h1>
      <Field
        label="Email"
        type="email"
        autoFocus={compact}
        required
        autoComplete="username"
        value={email}
        onChange={setEmail}
      />
      <Field
        label="Password"
        type="password"
        required
        autoComplete={needsSetup ? 'new-password' : 'current-password'}
        hint={needsSetup ? 'Use at least 12 characters.' : undefined}
        value={password}
        onChange={setPassword}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary">
        {needsSetup ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
