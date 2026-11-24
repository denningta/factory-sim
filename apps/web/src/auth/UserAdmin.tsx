import { useEffect, useState } from 'react';
import type { User } from '@factory-sim/schema';
import { Button, Field } from '../ui';
import styles from './auth.module.css';

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
    <section className={styles.form}>
      <h2 className={styles.subtitle}>Users</h2>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <ul className={styles.list}>
        {users?.map((u) => (
          <li key={u.id} className={styles.row}>
            <span className={styles.grow}>
              {u.email} ({u.role}
              {u.disabled ? ', disabled' : ''})
            </span>
            {u.id !== currentUserId && resetting !== u.id && (
              <Button onClick={() => startReset(u.id)}>Reset password for {u.email}</Button>
            )}
            {resetting === u.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(u);
                }}
                className={styles.inlineForm}
              >
                <Field
                  label={`New password for ${u.email}`}
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                />
                <Button type="submit" variant="primary">
                  Set password
                </Button>
                <Button onClick={() => startReset(null)}>Cancel</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
