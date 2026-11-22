import type { Entity, Resource, TimeWeighted, WaitHandle } from './api';
import { WaitList, waitHandle } from './waitlist';

/** What resources and queues need from the simulation. */
export interface Kernel {
  /** Delivers `action` as a zero-delay event (never synchronously). */
  defer(action: () => void): void;
  /** A time-weighted statistic reset by `resetStatistics()`. */
  timeWeighted(initial: number): TimeWeighted;
}

interface Request {
  readonly entity: Entity;
  readonly onGranted: () => void;
}

export function createResource(kernel: Kernel, name: string, capacity: number): Resource {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`Resource "${name}": capacity must be a positive integer, got ${capacity}`);
  }
  const waiting = new WaitList<Request>();
  /** Units held per entity (an entity may hold several). */
  const held = new Map<Entity, number>();
  let inUse = 0;
  const busy = kernel.timeWeighted(0);
  const queued = kernel.timeWeighted(0);

  const grantWaiting = () => {
    let node = waiting.first();
    while (node !== undefined && inUse < capacity) {
      const { entity, onGranted } = node.value;
      waiting.remove(node);
      inUse++;
      held.set(entity, (held.get(entity) ?? 0) + 1);
      kernel.defer(onGranted);
      node = waiting.first();
    }
    busy.update(inUse);
    queued.update(waiting.size);
  };

  return {
    name,
    capacity,
    get inUse() {
      return inUse;
    },
    get queueLength() {
      return waiting.size;
    },
    request(entity, onGranted): WaitHandle {
      const node = waiting.push({ entity, onGranted });
      grantWaiting();
      return waitHandle(waiting, node, () => queued.update(waiting.size));
    },
    release(entity) {
      const count = held.get(entity);
      if (count === undefined) {
        throw new Error(`Resource "${name}": entity ${entity.id} holds no unit`);
      }
      if (count === 1) held.delete(entity);
      else held.set(entity, count - 1);
      inUse--;
      grantWaiting();
    },
    utilization() {
      return busy.mean() / capacity;
    },
    averageQueueLength() {
      return queued.mean();
    },
  };
}
