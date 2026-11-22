import { describe, expect, it } from 'vitest';
import { createLoginThrottle } from './auth/rate-limit';

describe('login throttle', () => {
  it('AC2: allows 5 failures, then backs off exponentially up to a cap', () => {
    let t = 0;
    const throttle = createLoginThrottle(() => t);
    for (let i = 0; i < 5; i++) {
      expect(throttle.retryAfter('k')).toBe(0);
      throttle.fail('k');
    }
    expect(throttle.retryAfter('k')).toBe(1);
    t += 1000;
    expect(throttle.retryAfter('k')).toBe(0);
    throttle.fail('k'); // 6th: 2s
    expect(throttle.retryAfter('k')).toBe(2);
    for (let i = 0; i < 30; i++) {
      t += 10 * 60 * 1000;
      throttle.fail('k');
    }
    expect(throttle.retryAfter('k')).toBeLessThanOrEqual(15 * 60);
  });

  it('AC2: a successful sign-in clears the count', () => {
    const throttle = createLoginThrottle(() => 0);
    for (let i = 0; i < 6; i++) throttle.fail('k');
    throttle.succeed('k');
    expect(throttle.retryAfter('k')).toBe(0);
  });
});
