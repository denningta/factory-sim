import { useEffect, useState } from 'react';
import type { User } from '@factory-sim/schema';

export interface UserAdminApi {
  listUsers: () => Promise<User[]>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Admin: list users and set a new password for any other user (PL-9). */
export function UserAdmin({ api, currentUserId }: { api: UserAdminApi; currentUserId: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.listUsers().then(setUsers, (e: unknown) => setError(message(e)));
  }, [api]);

  const startReset = (id: string | null) => {
    setResetting(id);
    setPassword('');
    setError(null);
  };

  const submit = async (user: User) => {
    setError(null);
    setNotice(null);
    try {
      await api.resetPassword(user.id, password);
      setNotice(`Password reset for ${user.email}. Their sessions were signed out.`);
      setResetting(null);
      setPassword('');
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h2>Users</h2>
      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {users?.map((u) => (
          <li key={u.id}>
            {u.email} ({u.role}
            {u.disabled ? ', disabled' : ''}){' '}
            {u.id !== currentUserId && resetting !== u.id && (
              <button onClick={() => startReset(u.id)}>Reset password for {u.email}</button>
            )}
            {resetting === u.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(u);
                }}
                style={{ display: 'inline' }}
              >
                <label>
                  New password for {u.email}{' '}
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>{' '}
                <button type="submit">Set password</button>{' '}
                <button type="button" onClick={() => startReset(null)}>
                  Cancel
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
