/**
 * In-memory throttle for failed sign-ins, keyed by email + IP. One app instance only
 * (docs/stories/PL-6.md); state resets on restart, which is acceptable for the MVP.
 */
export interface LoginThrottle {
  /** Seconds until another attempt is allowed, or 0. */
  retryAfter(key: string): number;
  fail(key: string): void;
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
    retryAfter(key) {
      const entry = entries.get(key);
      if (!entry) return 0;
      const remaining = entry.blockedUntil - now();
      if (remaining > 0) return Math.ceil(remaining / 1000);
      // Expired lockouts keep their failure count (backoff continues), but idle entries
      // are dropped by fail() when the map grows.
      return 0;
    },
    fail(key) {
      if (entries.size >= MAX_ENTRIES && !entries.has(key)) {
        for (const [k, e] of entries) if (e.blockedUntil <= now()) entries.delete(k);
        // Still full of active lockouts: refuse to grow rather than evict attackers.
        if (entries.size >= MAX_ENTRIES) return;
      }
      const failures = (entries.get(key)?.failures ?? 0) + 1;
      const over = failures - FREE_FAILURES;
      const delay = over < 0 ? 0 : Math.min(BASE_DELAY_MS * 2 ** over, MAX_DELAY_MS);
      entries.set(key, { failures, blockedUntil: now() + delay });
    },
    succeed(key) {
      entries.delete(key);
    },
  };
}
