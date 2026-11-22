import {
  createUserRequestSchema,
  updateUserRequestSchema,
  userIdSchema,
  type User,
  type UserListResponse,
} from '@factory-sim/schema';
import { asc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { hashPassword } from '../auth/passwords';
import { deleteUserSessions } from '../auth/sessions';
import { requireUser, type AppContext } from '../context';
import { users } from '../db/schema';
import { HttpError, parseWith } from '../http-error';
import { toUser } from './auth';

export const userRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (app, { ctx }) => {
  const admin = { preHandler: requireUser(ctx, 'admin') };

  app.get('/api/users', admin, async (): Promise<UserListResponse> => {
    const rows = await ctx.db.select().from(users).orderBy(asc(users.createdAt), asc(users.email));
    return { users: rows.map(toUser) };
  });

  app.post('/api/users', admin, async (request, reply): Promise<User> => {
    const { email, password, role } = parseWith(createUserRequestSchema, request.body);
    const passwordHash = await hashPassword(password);
    const [row] = await ctx.db
      .insert(users)
      .values({ email, passwordHash, role })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!row) throw new HttpError('conflict', 'A user with that email already exists');
    reply.code(201);
    return toUser(row);
  });

  app.patch<{ Params: { id: string } }>('/api/users/:id', admin, async (request): Promise<User> => {
    const id = userIdSchema.safeParse(request.params.id);
    if (!id.success) throw new HttpError('not_found', 'User not found');
    const update = parseWith(updateUserRequestSchema, request.body);
    if (id.data === request.user!.id) {
      throw new HttpError('forbidden', 'You cannot disable or demote your own account');
    }
    const [row] = await ctx.db.update(users).set(update).where(eq(users.id, id.data)).returning();
    if (!row) throw new HttpError('not_found', 'User not found');
    // Disabling must take effect immediately, not when the idle window runs out.
    if (row.disabled) await deleteUserSessions(ctx.db, row.id);
    return toUser(row);
  });
};
