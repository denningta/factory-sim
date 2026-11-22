import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api/client';
import { createAutosaver, type SaveStatus } from './autosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(save: () => Promise<void>) {
  const statuses: SaveStatus[] = [];
  const saver = createAutosaver({ save, delayMs: 2000, onStatus: (s) => statuses.push(s) });
  return { saver, statuses };
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
});
