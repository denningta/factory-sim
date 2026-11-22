import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
