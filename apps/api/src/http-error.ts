import type { ApiError, ApiErrorCode } from '@factory-sim/schema';
import type { z } from 'zod';

const STATUS: Record<ApiErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  payload_too_large: 413,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/** Thrown by handlers; the server's error handler turns it into the ApiError body. */
export class HttpError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
  get status(): number {
    return STATUS[this.code];
  }
  body(): ApiError {
    return { error: { code: this.code, message: this.message } };
  }
}

/** Validates with the shared contract; the message lists every problem by field path. */
export function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => {
    const path = i.path.join('.');
    return path ? `${path}: ${i.message}` : i.message;
  });
  throw new HttpError('validation', problems.join('; '));
}
