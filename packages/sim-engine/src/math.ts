/**
 * Natural logarithm from exact IEEE-754 operations only, so it is bit-identical in every
 * JS engine (ADR-0007; `Math.log` is implementation-approximated). A direct port of
 * fdlibm's `__ieee754_log` (e_log.c, Sun Microsystems 1993), which is accurate to < 1 ulp.
 * Changing it changes every exponential sample and therefore reference-model results.
 */

const ln2Hi = 6.9314718036912381649e-1; // 0x3fe62e42 fee00000
const ln2Lo = 1.90821492927058770002e-10; // 0x3dea39ef 35793c76
const two54 = 1.8014398509481984e16; // 0x43500000 00000000
const Lg1 = 6.66666666666673513e-1;
const Lg2 = 3.999999999940941908e-1;
const Lg3 = 2.857142874366239149e-1;
const Lg4 = 2.222219843214978396e-1;
const Lg5 = 1.818357216161805012e-1;
const Lg6 = 1.531383769920937332e-1;
const Lg7 = 1.479819860511658591e-1;

// Word access to a double. Typed arrays use platform byte order; DataView pins it.
const view = new DataView(new ArrayBuffer(8));
/** The signed high and unsigned low 32-bit words of `x`, read in one call. */
function words(x: number): [hi: number, lo: number] {
  view.setFloat64(0, x);
  return [view.getInt32(0), view.getUint32(4)];
}
function withHiWord(x: number, hi: number): number {
  view.setFloat64(0, x);
  view.setInt32(0, hi);
  return view.getFloat64(0);
}

/** The largest double below `x` (finite `x`). */
export function nextDown(x: number): number {
  if (x === 0) return -Number.MIN_VALUE;
  const [hi, lo] = words(x);
  // Stepping the 64-bit pattern by one ulp: toward zero for x > 0, away for x < 0.
  const step = x > 0 ? -1 : 1;
  let newLo = lo + step;
  let newHi = hi;
  if (newLo < 0) {
    newLo = 0xffffffff;
    newHi--;
  } else if (newLo > 0xffffffff) {
    newLo = 0;
    newHi++;
  }
  view.setInt32(0, newHi);
  view.setUint32(4, newLo);
  return view.getFloat64(0);
}

export function log(input: number): number {
  let x = input;
  const [hx0, lx] = words(x);
  let hx = hx0;
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2^-1022: zero, negative or subnormal
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= two54;
    [hx] = words(x);
  }
  if (hx >= 0x7ff00000) return x + x; // Inf or NaN
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = withHiWord(x, hx | (i ^ 0x3ff00000)); // normalize x or x/2
  k += i >> 20;
  const f = x - 1;
  const dk = k;
  if ((0x000fffff & (2 + hx)) < 3) {
    // |f| < 2^-20
    if (f === 0) return k === 0 ? 0 : dk * ln2Hi + dk * ln2Lo;
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    return k === 0 ? f - R : dk * ln2Hi - (R - dk * ln2Lo - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  const R = t2 + t1;
  if (((hx - 0x6147a) | (0x6b851 - hx)) > 0) {
    const hfsq = 0.5 * f * f;
    return k === 0
      ? f - (hfsq - s * (hfsq + R))
      : dk * ln2Hi - (hfsq - (s * (hfsq + R) + dk * ln2Lo) - f);
  }
  return k === 0 ? f - s * (f - R) : dk * ln2Hi - (s * (f - R) - dk * ln2Lo - f);
}
