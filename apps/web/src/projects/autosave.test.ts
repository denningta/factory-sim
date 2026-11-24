import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api/client';
import { createAutosaver, type SaveStatus } from './autosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(save: () => Promise<void>) {
  const statuses: SaveStatus[] = [];
  const details: (ApiRequestError | undefined)[] = [];
  const saver = createAutosaver({
    save,
    delayMs: 2000,
    maxWaitMs: 4000,
    onStatus: (s, err) => {
      statuses.push(s);
      details.push(err);
    },
  });
  return { saver, statuses, details };
}

describe('autosave', () => {
  it('AC2: a change is saved within 5 seconds', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.markDirty();
    expect(statuses.at(-1)).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(4999);
    expect(save).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('AC2: a burst of changes becomes one save', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver } = setup(save);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(1500);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('AC2: a change made while saving is saved afterwards', async () => {
    let release!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.at(-1)).toBe('saving');
    saver.markDirty();
    release();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('AC2: a failed save is reported and retried within 5 seconds', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.at(-1)).toBe('error');
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('AC2: a conflict stops autosaving and tells the user instead of overwriting', async () => {
    const save = vi.fn().mockRejectedValue(new ApiRequestError('conflict', 'changed elsewhere'));
    const { saver, statuses } = setup(save);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.at(-1)).toBe('conflict');
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('AC2: flush saves right away, e.g. when leaving the project', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver } = setup(save);
    saver.markDirty();
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('AC2: continuous editing still saves within 5 seconds of the first change', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver } = setup(save);
    for (let t = 0; t < 10; t++) {
      saver.markDirty();
      await vi.advanceTimersByTimeAsync(1000);
      if (t === 4) expect(save).toHaveBeenCalledTimes(1); // first save no later than ~4 s
    }
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('AC2: a network failure (internal) keeps retrying', async () => {
    const save = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('internal', 'Cannot reach the server'));
    const { saver, statuses } = setup(save);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(7000);
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(statuses.at(-1)).toBe('error');
  });

  it.each(['validation', 'not_found', 'payload_too_large'] as const)(
    'AC2: a %s error stops retrying and reports the server message',
    async (code) => {
      const save = vi.fn().mockRejectedValue(new ApiRequestError(code, 'Server says no'));
      const { saver, statuses, details } = setup(save);
      saver.markDirty();
      await vi.advanceTimersByTimeAsync(2000);
      expect(statuses.at(-1)).toBe('stopped');
      expect(details.at(-1)).toMatchObject({ code, message: 'Server says no' });
      saver.markDirty();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(save).toHaveBeenCalledTimes(1);
    },
  );

  it('SC-2: an expired session holds the edits, stops retrying, and resume() saves them', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('unauthorized', 'Sign in again'))
      .mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.markDirty();
    await vi.advanceTimersByTimeAsync(2000);
    expect(statuses.at(-1)).toBe('signin');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    saver.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('saved');
  });
});
