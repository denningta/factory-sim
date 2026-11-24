import {
  userEquipmentTypeSchema,
  type EquipmentTypeListResponse,
  type UserEquipmentType,
} from '@factory-sim/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUser, type AppContext } from '../context';
import { equipmentTypes } from '../db/schema';
import { HttpError, parseWith } from '../http-error';

/** Stored documents were validated on the way in; re-check on the way out like projects do. */
function toType(row: typeof equipmentTypes.$inferSelect): UserEquipmentType {
  const parsed = userEquipmentTypeSchema.safeParse(row.document);
  if (!parsed.success) {
    console.error(`Stored equipment type ${row.id} is invalid`);
    throw new HttpError('internal', 'Stored equipment type is invalid');
  }
  return parsed.data;
}

export const equipmentTypeRoutes: FastifyPluginAsync<{ ctx: AppContext }> = async (
  app,
  { ctx },
) => {
  const guard = { preHandler: requireUser(ctx) };
  const notFound = () => new HttpError('not_found', 'Equipment type not found');
  // A malformed id can never match a stored uuid; answer 404 rather than a database error.
  const idOf = (raw: string) => {
    if (!z.uuid().safeParse(raw).success) throw notFound();
    return raw;
  };

  app.get('/api/equipment-types', guard, async (request): Promise<EquipmentTypeListResponse> => {
    const rows = await ctx.db
      .select()
      .from(equipmentTypes)
      .where(eq(equipmentTypes.ownerId, request.user!.id))
      // Case-insensitive by name; id breaks ties so the order is stable.
      .orderBy(sql`lower(${equipmentTypes.name})`, equipmentTypes.id);
    return { types: rows.map(toType) };
  });

  app.post('/api/equipment-types', guard, async (request, reply): Promise<UserEquipmentType> => {
    const type = parseWith(userEquipmentTypeSchema, request.body);
    const now = ctx.now();
    const [row] = await ctx.db
      .insert(equipmentTypes)
      .values({
        id: type.id,
        ownerId: request.user!.id,
        name: type.name,
        document: type,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    // Another user's id is a conflict too; the response must not reveal whose it is.
    if (!row) throw new HttpError('conflict', 'An equipment type with this id already exists');
    reply.code(201);
    return toType(row);
  });

  app.put<{ Params: { id: string } }>(
    '/api/equipment-types/:id',
    guard,
    async (request): Promise<UserEquipmentType> => {
      const id = idOf(request.params.id);
      const type = parseWith(userEquipmentTypeSchema, request.body);
      if (type.id !== id)
        throw new HttpError('validation', 'The id in the body must match the URL');
      const [row] = await ctx.db
        .update(equipmentTypes)
        .set({ name: type.name, document: type, updatedAt: ctx.now() })
        .where(and(eq(equipmentTypes.id, id), eq(equipmentTypes.ownerId, request.user!.id)))
        .returning();
      if (!row) throw notFound();
      return toType(row);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/equipment-types/:id',
    guard,
    async (request, reply) => {
      const deleted = await ctx.db
        .delete(equipmentTypes)
        .where(
          and(
            eq(equipmentTypes.id, idOf(request.params.id)),
            eq(equipmentTypes.ownerId, request.user!.id),
          ),
        )
        .returning({ id: equipmentTypes.id });
      if (deleted.length === 0) throw notFound();
      return reply.code(204).send();
    },
  );
};
