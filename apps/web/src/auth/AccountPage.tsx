import type { User } from '@factory-sim/schema';
import { api } from '../api/client';
import { ChangePassword } from './ChangePassword';
import { Button } from '../ui';
import styles from './auth.module.css';
import { UserAdmin } from './UserAdmin';

/** Account settings: change my password, and for admins reset other users' passwords (PL-9). */
export function AccountPage({ user, onBack }: { user: User; onBack: () => void }) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Account ({user.email})</h1>
        <Button onClick={onBack}>Back to projects</Button>
      </header>
      <ChangePassword api={api} />
      {user.role === 'admin' && <UserAdmin api={api} currentUserId={user.id} />}
    </section>
  );
}
