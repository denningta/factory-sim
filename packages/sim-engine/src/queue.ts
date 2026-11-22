import type { Queue } from './api';
import type { Kernel } from './resource';
import { WaitList, waitHandle } from './waitlist';

interface Put<T> {
  readonly item: T;
  readonly onStored: () => void;
}

export function createQueue<T>(kernel: Kernel, name: string, capacity = Infinity): Queue<T> {
  if (capacity !== Infinity && !(Number.isInteger(capacity) && capacity >= 1)) {
    throw new Error(
      `Queue "${name}": capacity must be a positive integer or Infinity, got ${capacity}`,
    );
  }
  // Array with a moving head: O(1) amortized FIFO without shifting.
  let items: T[] = [];
  let head = 0;
  const length = () => items.length - head;
  const putters = new WaitList<Put<T>>();
  const getters = new WaitList<(item: T) => void>();
  const lengthStat = kernel.timeWeighted(0);

  /** Admits waiting puts while there is room and serves waiting gets while there are items. */
  const settle = () => {
    for (;;) {
      const putter = putters.first();
      if (putter !== undefined && length() < capacity) {
        putters.remove(putter);
        items.push(putter.value.item);
        kernel.defer(putter.value.onStored);
        continue;
      }
      const getter = getters.first();
      if (getter !== undefined && length() > 0) {
        getters.remove(getter);
        const item = items[head]!;
        items[head++] = undefined as T; // drop the reference
        if (head > 1024 && head * 2 > items.length) {
          items = items.slice(head);
          head = 0;
        }
        const onItem = getter.value;
        kernel.defer(() => onItem(item));
        continue;
      }
      break;
    }
    lengthStat.update(length());
  };

  return {
    name,
    capacity,
    get length() {
      return length();
    },
    put(item, onStored) {
      const node = putters.push({ item, onStored });
      settle();
      return waitHandle(putters, node);
    },
    get(onItem) {
      const node = getters.push(onItem);
      settle();
      return waitHandle(getters, node);
    },
    averageLength() {
      return lengthStat.mean();
    },
  };
}
