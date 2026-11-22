import { describe, expect, it, vi } from 'vitest';
import { retry } from './migrate';

describe('retry', () => {
  it('N2: retries while the database is starting, logging each wait', async () => {
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue('ok');
    const log = vi.fn();
    await expect(retry(op, { attempts: 5, delayMs: 0, log })).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledWith('waiting for database');
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('N2: gives up with the last error after the attempts run out', async () => {
    const op = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('down'));
    await expect(retry(op, { attempts: 3, delayMs: 0, log: () => {} })).rejects.toThrow('down');
    expect(op).toHaveBeenCalledTimes(3);
  });
});
