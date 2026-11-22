import type { Project } from '@factory-sim/schema';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Metadata is relational; the editable content is the versioned JSONB document (ADR-0004). */
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  document: jsonb('document').$type<Project>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
