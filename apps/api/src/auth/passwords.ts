import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 hashes with argon2id by default (ADR-0011) and embeds salt and parameters.
export const hashPassword = (password: string): Promise<string> => hash(password);

/** Never throws on a malformed stored hash: that is simply "no match". */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/**
 * Hash to verify against when the email is unknown, so an unknown email costs the same as a
 * wrong password and response time doesn't reveal which emails have accounts.
 */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword('not-a-real-password');
  return dummy;
}
