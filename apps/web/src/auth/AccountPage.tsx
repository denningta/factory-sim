import type { User } from '@factory-sim/schema';
import { api } from '../api/client';
import { ChangePassword } from './ChangePassword';
import { UserAdmin } from './UserAdmin';

/** Account settings: change my password, and for admins reset other users' passwords (PL-9). */
export function AccountPage({ user, onBack }: { user: User; onBack: () => void }) {
  return (
    <section
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: 24,
        font: '14px sans-serif',
        display: 'grid',
        gap: 24,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Account ({user.email})</h1>
        <button onClick={onBack}>Back to projects</button>
      </header>
      <ChangePassword api={api} />
      {user.role === 'admin' && <UserAdmin api={api} currentUserId={user.id} />}
    </section>
  );
}
