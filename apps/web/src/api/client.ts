import {
  apiErrorSchema,
  projectDetailSchema,
  projectListResponseSchema,
  projectSummarySchema,
  sessionResponseSchema,
  setupStatusResponseSchema,
  type ApiErrorCode,
  type ProjectDetail,
  type ProjectSummary,
  type UpdateProjectRequest,
  type User,
} from '@factory-sim/schema';

/** Anything with a zod-style `parse`; keeps zod itself out of the web app's dependencies. */
interface Parser<T> {
  parse: (input: unknown) => T;
}

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Sends JSON, validates the response with the shared contract, and maps errors to ApiRequestError. */
async function request<T>(
  method: string,
  url: string,
  schema: Parser<T> | null,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiRequestError('internal', 'Cannot reach the server');
  }
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success)
      throw new ApiRequestError(parsed.data.error.code, parsed.data.error.message);
    throw new ApiRequestError('internal', `Request failed (${res.status})`);
  }
  return (schema ? schema.parse(await res.json()) : undefined) as T;
}

export const api = {
  setupNeeded: async () =>
    (await request('GET', '/api/auth/setup', setupStatusResponseSchema)).needsSetup,
  setup: async (email: string, password: string): Promise<User> =>
    (await request('POST', '/api/auth/setup', sessionResponseSchema, { email, password })).user,
  login: async (email: string, password: string): Promise<User> =>
    (await request('POST', '/api/auth/login', sessionResponseSchema, { email, password })).user,
  logout: async (): Promise<void> => request('POST', '/api/auth/logout', null),
  session: async (): Promise<User> =>
    (await request('GET', '/api/auth/session', sessionResponseSchema)).user,
  listProjects: async (): Promise<ProjectSummary[]> =>
    (await request('GET', '/api/projects', projectListResponseSchema)).projects,
  createProject: async (name: string): Promise<ProjectDetail> =>
    request('POST', '/api/projects', projectDetailSchema, { name }),
  getProject: async (id: string): Promise<ProjectDetail> =>
    request('GET', `/api/projects/${id}`, projectDetailSchema),
  updateProject: async (id: string, req: UpdateProjectRequest): Promise<ProjectSummary> =>
    request('PATCH', `/api/projects/${id}`, projectSummarySchema, req),
  deleteProject: async (id: string): Promise<void> =>
    request('DELETE', `/api/projects/${id}`, null),
};
