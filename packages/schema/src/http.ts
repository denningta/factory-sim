import { z } from 'zod';
import { equipmentTypeSchema } from './equipment';
import { projectSchema } from './project';

/**
 * HTTP contract between apps/web and apps/api (ADR-0003, ADR-0011). The API validates
 * requests with these schemas and generates OpenAPI from them; the web app validates
 * responses with them. All bodies are JSON, all timestamps ISO 8601 UTC strings.
 *
 * Routes (all under /api; every route except setup, login and /health needs a session):
 *
 * | Method + path              | Request              | Response                 | Story |
 * | -------------------------- | -------------------- | ------------------------ | ----- |
 * | GET    /api/auth/setup     | —                    | SetupStatusResponse      | PL-6  |
 * | POST   /api/auth/setup     | SetupRequest         | SessionResponse          | PL-6  |
 * | POST   /api/auth/login     | LoginRequest         | SessionResponse          | PL-6  |
 * | POST   /api/auth/logout    | —                    | 204                      | PL-6  |
 * | GET    /api/auth/session   | —                    | SessionResponse          | PL-6  |
 * | GET    /api/users          | —                    | UserListResponse (admin) | PL-6  |
 * | POST   /api/users          | CreateUserRequest    | User (admin)             | PL-6  |
 * | PATCH  /api/users/:id      | UpdateUserRequest    | User (admin)             | PL-6  |
 * | POST   /api/auth/password  | ChangePasswordRequest| 204                      | PL-9  |
 * | PUT    /api/users/:id/password | ResetPasswordRequest | 204 (admin)         | PL-9  |
 * | GET    /api/projects       | —                    | ProjectListResponse      | SC-1  |
 * | POST   /api/projects       | CreateProjectRequest | ProjectDetail            | SC-1  |
 * | GET    /api/projects/:id   | —                    | ProjectDetail            | SC-1  |
 * | PATCH  /api/projects/:id   | UpdateProjectRequest | ProjectSummary           | SC-1  |
 * | DELETE /api/projects/:id   | —                    | 204                      | SC-1  |
 * | GET    /api/equipment-types     | —                 | EquipmentTypeListResponse | EQ-3 |
 * | POST   /api/equipment-types     | UserEquipmentType | UserEquipmentType (201)   | EQ-3 |
 * | PUT    /api/equipment-types/:id | UserEquipmentType | UserEquipmentType         | EQ-3 |
 * | DELETE /api/equipment-types/:id | —                 | 204                       | EQ-3 |
 *
 * Mutating routes accept only `Content-Type: application/json` (no form parsers), which
 * together with SameSite cookies blocks cross-site form posts.
 *
 * Errors always use ApiError. Projects are private to the user who created them
 * (ADR-0011): another user's project id answers 404, not 403, so ids don't leak.
 */

export const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 256; // bounds argon2 work per request

const isoDateTime = z.iso.datetime();
export const userIdSchema = z.uuid();
export const projectIdSchema = z.uuid();

/** Trimmed and lower-cased, so sign-in is case-insensitive and emails are unique. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Policy for new passwords (setup, user creation). */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH);

/** Sign-in accepts any length within bounds; the policy only applies to new passwords. */
const passwordInputSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

// ---- Auth and users (PL-6) ----

export const roleSchema = z.enum(['admin', 'user']);

export const userSchema = z.strictObject({
  id: userIdSchema,
  email: emailSchema,
  role: roleSchema,
  disabled: z.boolean(),
  createdAt: isoDateTime,
});

export const setupStatusResponseSchema = z.strictObject({
  /** True until the first admin exists; the web app then shows the setup screen. */
  needsSetup: z.boolean(),
});

/** Creates the first admin. Only allowed while `needsSetup` is true, else 409. */
export const setupRequestSchema = z.strictObject({
  email: emailSchema,
  password: newPasswordSchema,
});

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordInputSchema,
});

/** The session itself is an httpOnly cookie; the body only says who is signed in. */
export const sessionResponseSchema = z.strictObject({ user: userSchema });

export const userListResponseSchema = z.strictObject({ users: z.array(userSchema) });

export const createUserRequestSchema = z.strictObject({
  email: emailSchema,
  password: newPasswordSchema,
  role: roleSchema.default('user'),
});

/** Disabling a user also ends their sessions. An admin can't disable or demote themself. */
export const updateUserRequestSchema = z
  .strictObject({ disabled: z.boolean().optional(), role: roleSchema.optional() })
  .refine((u) => u.disabled !== undefined || u.role !== undefined, {
    message: 'Nothing to update',
  });

/**
 * A signed-in user changes their own password (PL-9). A wrong `currentPassword` answers
 * `unauthorized`, and the sign-in throttle applies. Ends the user's other sessions and keeps
 * the current one.
 */
export const changePasswordRequestSchema = z.strictObject({
  currentPassword: passwordInputSchema,
  newPassword: newPasswordSchema,
});

/**
 * An admin sets another user's password (PL-9). Ends all of that user's sessions. For their
 * own account, admins use the change flow, and this route answers 403 `forbidden`.
 */
export const resetPasswordRequestSchema = z.strictObject({ newPassword: newPasswordSchema });

// ---- Projects (SC-1) ----

export const projectNameSchema = z.string().trim().min(1).max(200);

export const projectSummarySchema = z.strictObject({
  id: projectIdSchema,
  name: projectNameSchema,
  updatedAt: isoDateTime,
  /**
   * Increments on every successful update; the concurrency token for autosave. An
   * integer, not `updatedAt`, because Postgres stores microseconds and JS keeps
   * milliseconds, so timestamps never compare equal after a round trip.
   */
  revision: z.number().int().nonnegative(),
});

/** `document` is always the current schema version: the API upgrades on read (loadProject). */
export const projectDetailSchema = z.strictObject({
  ...projectSummarySchema.shape,
  document: projectSchema,
});

/** Newest first. */
export const projectListResponseSchema = z.strictObject({
  projects: z.array(projectSummarySchema),
});

/** The server creates the document with `createProject()`. */
export const createProjectRequestSchema = z.strictObject({ name: projectNameSchema });

/**
 * Rename and/or autosave. `baseRevision` is the `revision` the client last saw. The API
 * updates only `WHERE revision = baseRevision` (then increments it), so a project changed
 * since then, e.g. in another tab, answers 409 `conflict` instead of being overwritten.
 */
export const updateProjectRequestSchema = z
  .strictObject({
    name: projectNameSchema.optional(),
    document: projectSchema.optional(),
    baseRevision: z.number().int().nonnegative(),
  })
  .refine((u) => u.name !== undefined || u.document !== undefined, {
    message: 'Nothing to update',
  });

// ---- Equipment library (EQ-3) ----

/**
 * A user-defined library type (ADR-0010). Private to the user who created it, like projects
 * (ADR-0011), and usable in all of that user's projects. The built-ins (`BASE_EQUIPMENT_TYPES`)
 * are not stored or served; the web app lists them first.
 *
 * The client generates `id` as a lowercase UUID (what Postgres `uuid` returns, so ids round-trip), so it never collides with built-in ids and placed
 * instances can point at it (`typeId`) before the POST returns. POST with an existing id
 * answers 409 `conflict`; PUT needs `id` to equal `:id` (else 400 `validation`) and answers
 * 404 for a type the user doesn't own. PUT replaces the whole type; placed instances are
 * not touched (they keep their own copy, and the web app offers to update them).
 * DELETE leaves instances alone too; their `typeId` then matches nothing.
 */
export const userEquipmentTypeSchema = equipmentTypeSchema.refine(
  (t) => z.uuid().safeParse(t.id).success && t.id === t.id.toLowerCase(),
  { message: 'User-defined types need a lowercase UUID id', path: ['id'] },
);

/** Sorted by name (case-insensitive). */
export const equipmentTypeListResponseSchema = z.strictObject({
  types: z.array(userEquipmentTypeSchema),
});

// ---- Errors ----

export const apiErrorCodeSchema = z.enum([
  'validation', // 400: `message` lists each problem by field path
  'unauthorized', // 401: no or expired session, or wrong email/password
  'forbidden', // 403: signed in but not allowed (e.g. not an admin)
  'not_found', // 404
  'payload_too_large', // 413: body over the API's limit (Fastify default 1 MiB)
  'unsupported_media_type', // 415: mutating routes accept only application/json
  'conflict', // 409: setup already done, email taken, stale baseRevision
  'rate_limited', // 429: too many failed sign-ins; retry later
  'internal', // 500: details are logged, never returned
]);

export const apiErrorSchema = z.strictObject({
  error: z.strictObject({ code: apiErrorCodeSchema, message: z.string() }),
});

export type User = z.infer<typeof userSchema>;
export type Role = z.infer<typeof roleSchema>;
export type SetupStatusResponse = z.infer<typeof setupStatusResponseSchema>;
export type SetupRequest = z.infer<typeof setupRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
export type CreateUserRequest = z.input<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type UserEquipmentType = z.infer<typeof userEquipmentTypeSchema>;
export type EquipmentTypeListResponse = z.infer<typeof equipmentTypeListResponseSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
