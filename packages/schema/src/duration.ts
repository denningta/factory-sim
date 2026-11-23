import { z } from 'zod';

/** Seconds, strictly positive. */
const seconds = z.number().positive();
const nonNegative = z.number().nonnegative();

/**
 * A duration in seconds (WS-2): fixed, or a distribution sampled by the engine. Every
 * parameter is the real duration's value in seconds (lognormal `mean`/`stdDev` describe the
 * duration itself, not the underlying normal). The engine truncates samples at 0, so no
 * duration is ever negative (WS-2 AC3).
 */
export const durationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fixed'), value: seconds }),
  z.strictObject({ kind: z.literal('normal'), mean: seconds, stdDev: nonNegative }),
  z
    .strictObject({
      kind: z.literal('triangular'),
      min: nonNegative,
      mode: nonNegative,
      max: seconds,
    })
    .refine((d) => d.min <= d.mode && d.mode <= d.max && d.min < d.max, {
      message: 'Needs min ≤ most likely ≤ max, with min < max',
      path: ['mode'],
    }),
  z.strictObject({ kind: z.literal('lognormal'), mean: seconds, stdDev: nonNegative }),
  z.strictObject({ kind: z.literal('exponential'), mean: seconds }),
]);

export type Duration = z.infer<typeof durationSchema>;
export type DurationKind = Duration['kind'];
