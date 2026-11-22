import {
  CURRENT_SCHEMA_VERSION,
  createProject,
  createProjectRequestSchema,
  loadProject,
  projectIdSchema,
  updateProjectRequestSchema,
  type ProjectDetail,
  type ProjectListResponse,
  type ProjectSummary,
} from '@factory-sim/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { requireUser, type AppContext } from '../context';
import { projects } from '../db/schema';
import { HttpError, parseWith } from '../http-error';

type ProjectRow = typeof projects.$inferSelect;

const STALE_APP = 'The app was updated. Reload to keep editing.';

const toSummary = (row: ProjectRow): ProjectSummary => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updatedAt.toISOString(),
  revision: row.revision,
});

function toDetail(row: ProjectRow): ProjectDetail {
  const loaded = loadProject(row.document);
  if (!loaded.ok) {
    console.error(`Stored project ${row.id} is invalid: ${loaded.error}`);
    throw new HttpError('internal', 'Stored project is invalid');
  }
  return { ...toSummary(row), document: loaded.project };
}

export const projectRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (app, { ctx }) => {
  const guard = { preHandler: requireUser(ctx) };
  const notFound = () => new HttpError('not_found', 'Project not found');
  const idOf = (raw: string) => {
    const id = projectIdSchema.safeParse(raw);
    if (!id.success) throw notFound();
    return id.data;
  };

  app.get('/api/projects', guard, async (request): Promise<ProjectListResponse> => {
    const rows = await ctx.db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, request.user!.id))
      .orderBy(desc(projects.updatedAt));
    return { projects: rows.map(toSummary) };
  });

  app.post('/api/projects', guard, async (request, reply): Promise<ProjectDetail> => {
    const { name } = parseWith(createProjectRequestSchema, request.body);
    const now = ctx.now();
    const [row] = await ctx.db
      .insert(projects)
      .values({
        ownerId: request.user!.id,
        name,
        document: createProject(),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    reply.code(201);
    return toDetail(row!);
  });

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id',
    guard,
    async (request): Promise<ProjectDetail> => {
      const [row] = await ctx.db
        .select()
        .from(projects)
        .where(
          and(eq(projects.id, idOf(request.params.id)), eq(projects.ownerId, request.user!.id)),
        );
      if (!row) throw notFound();
      return toDetail(row);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/api/projects/:id',
    guard,
    async (request): Promise<ProjectSummary> => {
      const id = idOf(request.params.id);
      // Autosave must send the current version: an older tab would otherwise silently downgrade
      // a project another tab already upgraded. Checked first so the user gets one clear message
      // instead of a field list.
      const sent = (request.body as { document?: { schemaVersion?: unknown } } | null)?.document;
      if (typeof sent?.schemaVersion === 'number' && sent.schemaVersion < CURRENT_SCHEMA_VERSION)
        throw new HttpError('validation', STALE_APP);
      const update = parseWith(updateProjectRequestSchema, request.body);
      const owner = and(eq(projects.id, id), eq(projects.ownerId, request.user!.id));
      const [row] = await ctx.db
        .update(projects)
        .set({
          ...(update.name === undefined ? {} : { name: update.name }),
          ...(update.document === undefined ? {} : { document: update.document }),
          revision: sql`${projects.revision} + 1`,
          updatedAt: ctx.now(),
        })
        .where(and(owner, eq(projects.revision, update.baseRevision)))
        .returning();
      if (row) return toSummary(row);
      // Zero rows: missing (or someone else's) is 404, otherwise the revision was stale.
      const [exists] = await ctx.db.select({ id: projects.id }).from(projects).where(owner);
      throw exists ? new HttpError('conflict', 'This project was changed elsewhere') : notFound();
    },
  );

  app.delete<{ Params: { id: string } }>('/api/projects/:id', guard, async (request, reply) => {
    const deleted = await ctx.db
      .delete(projects)
      .where(and(eq(projects.id, idOf(request.params.id)), eq(projects.ownerId, request.user!.id)))
      .returning({ id: projects.id });
    if (deleted.length === 0) throw notFound();
    return reply.code(204).send();
  });
};
