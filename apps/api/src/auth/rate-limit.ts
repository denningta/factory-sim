/**
 * In-memory throttle for failed sign-ins, keyed by email + IP. One app instance only
 * (docs/stories/PL-6.md); state resets on restart, which is acceptable for the MVP.
 */
export interface LoginThrottle {
  /**
   * Call synchronously before verifying a password. Returns the seconds to wait if the key is
   * locked out (the attempt is refused and not counted), else 0 and the attempt is reserved
   * as a failure. Reserving up front means concurrent requests can't all slip past the check
   * while the slow argon2 verify is in flight.
   */
  attempt(key: string): number;
  /** Clears the key after a correct password. */
  succeed(key: string): void;
}

interface Entry {
  failures: number;
  blockedUntil: number;
}

const FREE_FAILURES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;

export function createLoginThrottle(now: () => number = Date.now): LoginThrottle {
  const entries = new Map<string, Entry>();
  return {
    attempt(key) {
      const entry = entries.get(key);
      if (entry && entry.blockedUntil > now())
        return Math.ceil((entry.blockedUntil - now()) / 1000);
      if (!entry && entries.size >= MAX_ENTRIES) {
        for (const [k, e] of entries) if (e.blockedUntil <= now()) entries.delete(k);
        // Still full of active lockouts: don't evict them to track a new key.
        if (entries.size >= MAX_ENTRIES) return 0;
      }
      const failures = (entry?.failures ?? 0) + 1;
      const over = failures - FREE_FAILURES;
      const delay = over < 0 ? 0 : Math.min(BASE_DELAY_MS * 2 ** over, MAX_DELAY_MS);
      entries.set(key, { failures, blockedUntil: now() + delay });
      return 0;
    },
    succeed(key) {
      entries.delete(key);
    },
  };
}
