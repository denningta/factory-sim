import { describe, expect, it } from 'vitest';
import { createLoginThrottle } from './auth/rate-limit';

describe('login throttle', () => {
  it('AC2: allows 5 attempts, then backs off exponentially up to a cap', () => {
    let t = 0;
    const throttle = createLoginThrottle(() => t);
    for (let i = 0; i < 5; i++) expect(throttle.attempt('k')).toBe(0);
    expect(throttle.attempt('k')).toBe(1); // refused attempts are not counted
    t += 1000;
    expect(throttle.attempt('k')).toBe(0); // 6th: next lockout 2s
    expect(throttle.attempt('k')).toBe(2);
    for (let i = 0; i < 30; i++) {
      t += 15 * 60 * 1000;
      throttle.attempt('k');
    }
    expect(throttle.attempt('k')).toBeLessThanOrEqual(15 * 60);
  });

  it('AC2: a successful sign-in clears the count', () => {
    const throttle = createLoginThrottle(() => 0);
    for (let i = 0; i < 5; i++) throttle.attempt('k');
    throttle.succeed('k');
    expect(throttle.attempt('k')).toBe(0);
  });
});
