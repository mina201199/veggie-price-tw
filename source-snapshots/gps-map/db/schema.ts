import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cloudNotes = sqliteTable('cloud_notes', {
  userId: text('user_id').primaryKey(),
  version: integer('version').notNull(),
  document: text('document').notNull(),
});

export const cloudPlans = sqliteTable('cloud_plans', {
  userId: text('user_id').primaryKey(),
  version: integer('version').notNull(),
  document: text('document').notNull(),
});
