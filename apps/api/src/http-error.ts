import type { ApiError, ApiErrorCode } from '@factory-sim/schema';
import type { z } from 'zod';

const STATUS: Record<ApiErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
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

/** Maps anything thrown (ours or Fastify's) to the ApiError response; 5xx details are not exposed. */
export function toErrorResponse(error: Error & { statusCode?: number; code?: string }): {
  status: number;
  body: ApiError;
} {
  if (error instanceof HttpError) return { status: error.status, body: error.body() };
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    const e = new HttpError('payload_too_large', 'Request body too large');
    return { status: e.status, body: e.body() };
  }
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    const e = new HttpError('unsupported_media_type', 'Send application/json');
    return { status: e.status, body: e.body() };
  }
  const status = error.statusCode;
  if (status !== undefined && status >= 400 && status < 500) {
    // Other client errors Fastify raises (400, 415, 405, ...): keep the status.
    return { status, body: new HttpError('validation', error.message).body() };
  }
  return { status: 500, body: new HttpError('internal', 'Internal server error').body() };
}
