import {
  createUserRequestSchema,
  resetPasswordRequestSchema,
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

  app.put<{ Params: { id: string } }>('/api/users/:id/password', admin, async (request, reply) => {
    const id = userIdSchema.safeParse(request.params.id);
    if (!id.success) throw new HttpError('not_found', 'User not found');
    if (id.data === request.user!.id) {
      throw new HttpError('forbidden', 'Change your own password from your account instead');
    }
    const { newPassword } = parseWith(resetPasswordRequestSchema, request.body);
    const passwordHash = await hashPassword(newPassword);
    // One transaction so a failure can't leave the new password with the old sessions alive.
    const found = await ctx.db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, id.data))
        .returning({ id: users.id });
      if (row) await deleteUserSessions(tx, row.id);
      return row;
    });
    if (!found) throw new HttpError('not_found', 'User not found');
    return reply.code(204).send();
  });
};
