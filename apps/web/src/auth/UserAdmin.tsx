import type { User } from '@factory-sim/schema';

export interface UserAdminApi {
  listUsers: () => Promise<User[]>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
}

export function UserAdmin(_props: { api: UserAdminApi; currentUserId: string }) {
  return null;
}
