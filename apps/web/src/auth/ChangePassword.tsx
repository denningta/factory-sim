export interface ChangePasswordApi {
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function ChangePassword(_props: { api: ChangePasswordApi }) {
  return null;
}
