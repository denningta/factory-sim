import { useState } from 'react';

export interface ChangePasswordApi {
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

/** Signed-in user changes their own password (PL-9). Their other sessions end server-side. */
export function ChangePassword({ api }: { api: ChangePasswordApi }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async () => {
    setError(null);
    setDone(false);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setDone(true);
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
      style={{ display: 'grid', gap: 8, maxWidth: 360 }}
    >
      <h2>Change password</h2>
      <label>
        Current password{' '}
        <input
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label>
        New password{' '}
        <input
          type="password"
          required
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <small>Use at least 12 characters.</small>
      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
      {done && <p role="status">Password changed. Your other sessions were signed out.</p>}
      <button type="submit">Change password</button>
    </form>
  );
}
