import type { CreateRng, Rng } from './api';
import { log, nextDown } from './math';

/**
 * PRNG: sfc32 (Chris Doty-Humphrey's Small Fast Counting generator, 128-bit state),
 * seeded from a 32-bit seed: the state words are successive values of a golden-ratio
 * Weyl sequence (`s += 0x9e3779b9`), each passed through murmur3's `fmix32` finalizer,
 * followed by 12 discarded outputs. Integer-only (`Math.imul`, `| 0`, `>>>`),
 * so it is bit-exact in every JS runtime. Doubles carry 53 random bits from two outputs.
 *
 * Changing the algorithm, seeding, `fork` hashing or the `next`/`exponential`
 * transforms changes every simulation result, so it requires re-baselining the
 * reference model. `rng.test.ts` pins golden values to catch that.
 */

function normalizeSeed(seed: number): number {
  if (!Number.isInteger(seed)) throw new Error(`Seed must be an integer, got ${seed}`);
  // `>>> 0` takes the value modulo 2^32 (via ToUint32), also for |seed| > 2^32.
  return seed >>> 0;
}

/** murmur3's 32-bit finalizer (`fmix32`): a bijective avalanche mix. */
function fmix32(state: number): number {
  let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** FNV-1a over the label's UTF-16 code units. */
function hashLabel(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const TWO_POW_26 = 67108864;
const TWO_POW_53 = 9007199254740992;

function makeRng(seed: number): Rng {
  let s = seed;
  const seedWord = () => fmix32((s = (s + 0x9e3779b9) | 0));
  let a = seedWord() | 0;
  let b = seedWord() | 0;
  let c = seedWord() | 0;
  let d = seedWord() | 0;

  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Discard the first outputs so similar seeds diverge fully.
  for (let i = 0; i < 12; i++) nextUint32();

  const next = (): number => {
    const hi = nextUint32() >>> 5; // 27 bits
    const lo = nextUint32() >>> 6; // 26 bits
    return (hi * TWO_POW_26 + lo) / TWO_POW_53;
  };

  return {
    next,
    uniform(min, max) {
      if (!(max >= min)) throw new Error(`uniform: need min <= max, got [${min}, ${max})`);
      if (max === min) return min;
      const x = min + next() * (max - min);
      // Rounding can land on max when |min| dwarfs max - min; keep the range half-open.
      return x < max ? x : nextDown(max);
    },
    integer(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
        throw new Error(`integer: need integers min < max, got [${min}, ${max})`);
      }
      return min + Math.floor(next() * (max - min));
    },
    exponential(mean) {
      if (!(mean > 0 && Number.isFinite(mean))) {
        throw new Error(`exponential: mean must be finite and > 0, got ${mean}`);
      }
      // 1 - u is in (0, 1], so the log is finite.
      return -mean * log(1 - next());
    },
    fork(label) {
      return makeRng(fmix32(seed ^ hashLabel(label)));
    },
  };
}

export const createRng: CreateRng = (seed) => makeRng(normalizeSeed(seed));
