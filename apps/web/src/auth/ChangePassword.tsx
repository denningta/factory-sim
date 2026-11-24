import { useState } from 'react';
import { Button, Field } from '../ui';
import styles from './auth.module.css';

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
      className={styles.form}
    >
      <h2 className={styles.subtitle}>Change password</h2>
      <Field
        label="Current password"
        type="password"
        required
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
      />
      <Field
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        hint="Use at least 12 characters."
        value={next}
        onChange={setNext}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" className={styles.notice}>
          Password changed. Your other sessions were signed out.
        </p>
      )}
      <Button type="submit" variant="primary">
        Change password
      </Button>
    </form>
  );
}
