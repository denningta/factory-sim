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

const halF = [0.5, -0.5];
const expHi = 7.09782712893383973096e2; // above: overflow
const expLo = -7.4513321910194110842e2; // below: underflow to 0
const ln2HiPair = [6.9314718036912381649e-1, -6.9314718036912381649e-1];
const ln2LoPair = [1.90821492927058770002e-10, -1.90821492927058770002e-10];
const invLn2 = 1.442695040888963387;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.6533902205465251539e-6;
const P5 = 4.13813679705723846039e-8;
const twoM1000 = 9.3326361850321887899e-302; // 2^-1000

/**
 * e^x from exact operations only (lognormal samples). A port of fdlibm's `__ieee754_exp`
 * (e_exp.c), accurate to < 1 ulp; same bit-exactness rationale as `log`.
 */
export function exp(input: number): number {
  let x = input;
  const [hx0] = words(x);
  const xsb = (hx0 >>> 31) & 1;
  const hx = hx0 & 0x7fffffff;
  if (hx >= 0x40862e42) {
    // |x| >= 709.78…: overflow, underflow, Inf or NaN
    if (Number.isNaN(x)) return x;
    if (x === -Infinity) return 0;
    if (x > expHi) return Infinity;
    if (x < expLo) return 0;
  }
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (hx > 0x3fd62e42) {
    // |x| > 0.5 ln2: reduce to x = k ln2 + r, |r| <= 0.5 ln2
    if (hx < 0x3ff0a2b2) {
      hi = x - ln2HiPair[xsb]!;
      lo = ln2LoPair[xsb]!;
      k = 1 - xsb - xsb;
    } else {
      k = Math.trunc(invLn2 * x + halF[xsb]!);
      hi = x - k * ln2HiPair[0]!;
      lo = k * ln2LoPair[0]!;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    return 1 + x; // |x| < 2^-28
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - (lo - (x * c) / (2 - c) - hi);
  const [hy] = words(y);
  if (k >= -1021) return withHiWord(y, hy + (k << 20));
  return withHiWord(y, hy + ((k + 1000) << 20)) * twoM1000;
}

const pio2Hi = 1.57079632673412561417; // first 33 bits of pi/2
const pio2Lo = 6.07710050650619224932e-11; // pi/2 - pio2Hi
const twoOverPi = 6.36619772367581382433e-1;
const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.0875723212981748279e-9;
const C6 = -1.13596475577881948265e-11;

/** fdlibm `__kernel_sin` on [−π/4, π/4]; `y` is the tail of the reduced argument. */
function kernelSin(x: number, y: number): number {
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

/** fdlibm `__kernel_cos` (FreeBSD k_cos.c) on [−π/4, π/4]. */
function kernelCos(x: number, y: number): number {
  const z = x * x;
  const w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  const a = 1 - hz;
  return a + (1 - a - hz + (z * r - x * y));
}

/**
 * [sin x, cos x] from exact operations only (port positions on rotated equipment). Range
 * reduction by a two-part π/2 is accurate for |x| < 2^20, far beyond any rotation; fdlibm
 * kernels do the rest.
 */
export function sinCos(x: number): [sin: number, cos: number] {
  const k = Math.round(x * twoOverPi);
  const head = x - k * pio2Hi;
  const r = head - k * pio2Lo;
  const tail = head - r - k * pio2Lo;
  const s = kernelSin(r, tail);
  const c = kernelCos(r, tail);
  switch (k & 3) {
    case 0:
      return [s, c];
    case 1:
      return [c, -s];
    case 2:
      return [-s, -c];
    default:
      return [-c, s];
  }
}
