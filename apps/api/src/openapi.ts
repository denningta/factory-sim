import {
  apiErrorSchema,
  createProjectRequestSchema,
  createUserRequestSchema,
  loginRequestSchema,
  projectDetailSchema,
  projectListResponseSchema,
  projectSummarySchema,
  sessionResponseSchema,
  setupRequestSchema,
  setupStatusResponseSchema,
  updateProjectRequestSchema,
  updateUserRequestSchema,
  userListResponseSchema,
  userSchema,
} from '@factory-sim/schema';
import { z } from 'zod';

// Built from the shared zod contract (ADR-0003) so docs can't drift from validation.
const json = (schema: z.ZodType, io: 'input' | 'output') =>
  z.toJSONSchema(schema, { io, unrepresentable: 'any', target: 'draft-2020-12' });

const body = (schema: z.ZodType) => ({
  required: true,
  content: { 'application/json': { schema: json(schema, 'input') } },
});
const ok = (schema: z.ZodType, status = '200') => ({
  [status]: {
    description: 'Success',
    content: { 'application/json': { schema: json(schema, 'output') } },
  },
});
const errors = {
  default: {
    description: 'Error',
    content: { 'application/json': { schema: json(apiErrorSchema, 'output') } },
  },
};
const idParam = [
  { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
];

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: { title: 'Factory Flow Simulator API', version: '0.0.0' },
    paths: {
      '/api/auth/setup': {
        get: {
          summary: 'Is first-admin setup needed?',
          responses: { ...ok(setupStatusResponseSchema), ...errors },
        },
        post: {
          summary: 'Create the first admin (only while none exists)',
          requestBody: body(setupRequestSchema),
          responses: { ...ok(sessionResponseSchema), ...errors },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'Sign in',
          requestBody: body(loginRequestSchema),
          responses: { ...ok(sessionResponseSchema), ...errors },
        },
      },
      '/api/auth/logout': {
        post: {
          summary: 'Sign out',
          responses: { '204': { description: 'Signed out' }, ...errors },
        },
      },
      '/api/auth/session': {
        get: { summary: 'Current user', responses: { ...ok(sessionResponseSchema), ...errors } },
      },
      '/api/users': {
        get: {
          summary: 'List users (admin)',
          responses: { ...ok(userListResponseSchema), ...errors },
        },
        post: {
          summary: 'Create a user (admin)',
          requestBody: body(createUserRequestSchema),
          responses: { ...ok(userSchema, '201'), ...errors },
        },
      },
      '/api/projects': {
        get: {
          summary: 'List my projects, newest first',
          responses: { ...ok(projectListResponseSchema), ...errors },
        },
        post: {
          summary: 'Create an empty project',
          requestBody: body(createProjectRequestSchema),
          responses: { ...ok(projectDetailSchema, '201'), ...errors },
        },
      },
      '/api/projects/{id}': {
        get: {
          summary: 'Open a project (upgraded to the current schema version)',
          parameters: idParam,
          responses: { ...ok(projectDetailSchema), ...errors },
        },
        patch: {
          summary: 'Rename and/or autosave; 409 when baseRevision is stale',
          parameters: idParam,
          requestBody: body(updateProjectRequestSchema),
          responses: { ...ok(projectSummarySchema), ...errors },
        },
        delete: {
          summary: 'Delete a project',
          parameters: idParam,
          responses: { '204': { description: 'Deleted' }, ...errors },
        },
      },
      '/api/users/{id}': {
        patch: {
          summary: 'Disable, enable or change the role of a user (admin)',
          parameters: idParam,
          requestBody: body(updateUserRequestSchema),
          responses: { ...ok(userSchema), ...errors },
        },
      },
    },
  };
}
