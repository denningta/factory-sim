import type { CreateSimulation, EventHandle, Tally, TimeWeighted } from './api';
import { Calendar } from './calendar';
import { createQueue } from './queue';
import { createResource, type Kernel } from './resource';
import { createRng } from './rng';
import { createTally, createTimeWeighted } from './stats';

export const createSimulation: CreateSimulation = ({ seed }) => {
  const rng = createRng(seed);
  const calendar = new Calendar();
  const tallies: Tally[] = [];
  const timeWeighted: TimeWeighted[] = [];
  let now = 0;
  let nextEntityId = 1;
  let inEvent = false;

  const clock = () => now;
  const assertNotInEvent = (method: string) => {
    if (inEvent) throw new Error(`${method}() cannot be called from inside an event`);
  };

  const schedule = (delay: number, action: () => void, priority = 0): EventHandle => {
    if (!(delay >= 0 && Number.isFinite(delay))) {
      throw new Error(`Delay must be finite and >= 0, got ${delay}`);
    }
    if (!Number.isFinite(priority)) throw new Error(`Priority must be finite, got ${priority}`);
    const event = calendar.push(now + delay, priority, action);
    return {
      time: event.time,
      cancel: () => calendar.cancel(event),
    };
  };

  const runNext = (): boolean => {
    const event = calendar.pop();
    if (event === undefined) return false;
    now = event.time;
    inEvent = true;
    try {
      event.action();
    } finally {
      inEvent = false;
    }
    return true;
  };

  const newTimeWeighted = (initial: number): TimeWeighted => {
    const stat = createTimeWeighted(clock, initial);
    timeWeighted.push(stat);
    return stat;
  };

  const kernel: Kernel = {
    defer: (action) => void schedule(0, action),
    timeWeighted: newTimeWeighted,
  };

  return {
    get now() {
      return now;
    },
    rng,
    get pendingEvents() {
      return calendar.pending;
    },
    schedule,
    step() {
      assertNotInEvent('step');
      return runNext();
    },
    runUntil(time) {
      assertNotInEvent('runUntil');
      if (!Number.isFinite(time) || time < now) {
        throw new Error(`runUntil(${time}): time must be finite and >= now (${now})`);
      }
      for (
        let next = calendar.peek();
        next !== undefined && next.time <= time;
        next = calendar.peek()
      ) {
        runNext();
      }
      now = time;
    },
    createEntity(data) {
      if ('id' in data || 'createdAt' in data) {
        throw new Error('Entity data may not contain id or createdAt');
      }
      return { ...data, id: nextEntityId++, createdAt: now };
    },
    createResource: (name, capacity) => createResource(kernel, name, capacity),
    createQueue: (name, capacity) => createQueue(kernel, name, capacity),
    createTally() {
      const tally = createTally();
      tallies.push(tally);
      return tally;
    },
    createTimeWeighted: (initial = 0) => newTimeWeighted(initial),
    resetStatistics() {
      for (const t of tallies) t.reset();
      for (const t of timeWeighted) t.reset();
    },
  };
};
