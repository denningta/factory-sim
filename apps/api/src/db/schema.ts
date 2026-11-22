import { sql } from 'drizzle-orm';
import { boolean, check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Metadata is relational; the editable content is the versioned JSONB document (ADR-0004).
 * `document` is `unknown` on purpose: reads go through `loadProject` and writes through
 * `validateProject`, never a bare cast.
 */
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  document: jsonb('document').$type<unknown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Stored lower-cased and trimmed by emailSchema, so a plain unique index is case-insensitive.
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'user'] }).notNull(),
    disabled: boolean('disabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('users_role_check', sql`${t.role} in ('admin', 'user')`)],
);

/** `id_hash` is an HMAC of the cookie value, so a database leak doesn't yield usable sessions. */
export const sessions = pgTable('sessions', {
  idHash: text('id_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
});

/**
 * At most one row (the primary key is the constant `true`). First-admin setup inserts it in
 * the same transaction as the admin, so concurrent setups can't both succeed.
 */
export const instanceSetup = pgTable(
  'instance_setup',
  { id: boolean('id').primaryKey().default(true) },
  (t) => [check('instance_setup_singleton', sql`${t.id} = true`)],
);
