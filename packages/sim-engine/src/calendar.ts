import type { SimTime } from './api';

export interface CalendarEvent {
  readonly time: SimTime;
  readonly priority: number;
  /** Schedule order; breaks ties FIFO. */
  readonly seq: number;
  readonly action: () => void;
  cancelled: boolean;
  done: boolean;
}

function before(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.time !== b.time) return a.time < b.time;
  if (a.priority !== b.priority) return a.priority < b.priority;
  return a.seq < b.seq;
}

/**
 * Future event list: a binary min-heap ordered by (time, priority, seq). Cancelled
 * events stay in the heap and are dropped when they reach the top (lazy deletion).
 */
export class Calendar {
  private readonly heap: CalendarEvent[] = [];
  private seq = 0;
  /** Events not yet run or cancelled. */
  pending = 0;

  push(time: SimTime, priority: number, action: () => void): CalendarEvent {
    const event: CalendarEvent = {
      time,
      priority,
      seq: this.seq++,
      action,
      cancelled: false,
      done: false,
    };
    const heap = this.heap;
    heap.push(event);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(event, heap[parent]!)) break;
      heap[i] = heap[parent]!;
      i = parent;
    }
    heap[i] = event;
    this.pending++;
    return event;
  }

  cancel(event: CalendarEvent): void {
    if (event.cancelled || event.done) return;
    event.cancelled = true;
    this.pending--;
  }

  /** The next live event without removing it. */
  peek(): CalendarEvent | undefined {
    while (this.heap.length > 0 && this.heap[0]!.cancelled) this.removeTop();
    return this.heap[0];
  }

  /** Removes and returns the next live event, marked done. */
  pop(): CalendarEvent | undefined {
    const event = this.peek();
    if (event === undefined) return undefined;
    this.removeTop();
    event.done = true;
    this.pending--;
    return event;
  }

  private removeTop(): void {
    const heap = this.heap;
    const last = heap.pop()!;
    if (heap.length === 0) return;
    const n = heap.length;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const r = l + 1;
      const child = r < n && before(heap[r]!, heap[l]!) ? r : l;
      if (!before(heap[child]!, last)) break;
      heap[i] = heap[child]!;
      i = child;
    }
    heap[i] = last;
  }
}
