import type { SimTime, Tally, TimeWeighted } from './api';

/** Welford's online algorithm: numerically stable mean and variance. */
export function createTally(): Tally {
  let count = 0;
  let mean = NaN;
  let m2 = 0;
  let min = NaN;
  let max = NaN;
  return {
    add(value) {
      count++;
      if (count === 1) {
        mean = min = max = value;
        m2 = 0;
        return;
      }
      const delta = value - mean;
      mean += delta / count;
      m2 += delta * (value - mean);
      if (value < min) min = value;
      if (value > max) max = value;
    },
    get count() {
      return count;
    },
    get mean() {
      return mean;
    },
    get variance() {
      return count < 2 ? NaN : m2 / (count - 1);
    },
    get min() {
      return min;
    },
    get max() {
      return max;
    },
    reset() {
      count = 0;
      mean = min = max = NaN;
      m2 = 0;
    },
  };
}

export function createTimeWeighted(clock: () => SimTime, initial: number): TimeWeighted {
  let current = initial;
  let start = clock();
  let last = start;
  let area = 0;
  return {
    update(value) {
      const now = clock();
      area += current * (now - last);
      last = now;
      current = value;
    },
    get current() {
      return current;
    },
    mean() {
      const now = clock();
      const elapsed = now - start;
      return elapsed === 0 ? current : (area + current * (now - last)) / elapsed;
    },
    reset() {
      start = last = clock();
      area = 0;
    },
  };
}
