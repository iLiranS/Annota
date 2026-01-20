import type { SortType } from '@/dev-data/data';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ============ NOTE METADATA (fast, for lists) ============
export const noteMetadata = sqliteTable('note_metadata', {
    id: text('id').primaryKey(),
    folderId: text('folder_id'),
    title: text('title').notNull().default('Untitled Note'),
    preview: text('preview').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    isQuickAccess: integer('is_quick_access', { mode: 'boolean' }).notNull().default(false),
    tags: text('tags').notNull().default('[]'), // JSON array of tag IDs
    originalFolderId: text('original_folder_id'),
});

// ============ NOTE CONTENT (heavy, lazy loaded) ============
export const noteContent = sqliteTable('note_content', {
    noteId: text('note_id').primaryKey(),
    content: text('content').notNull().default(''),
});

// ============ NOTE VERSIONS ============
export const noteVersions = sqliteTable('note_versions', {
    id: text('id').primaryKey(),
    noteId: text('note_id').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ FOLDERS ============
export const folders = sqliteTable('folders', {
    id: text('id').primaryKey(),
    parentId: text('parent_id'),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('folder'),
    color: text('color').notNull().default('#F59E0B'), // Amber color
    sortType: text('sort_type').$type<SortType>().notNull().default('UPDATED_LAST'),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    originalParentId: text('original_parent_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============ TASKS ============
export const tasks = sqliteTable('tasks', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    deadline: integer('deadline', { mode: 'timestamp' }).notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    linkedNoteId: text('linked_note_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ TAGS ============
export const tags = sqliteTable('tags', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
});

// ============ SETTINGS ============
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(), // JSON
});

// ============ TYPE EXPORTS ============
export type NoteMetadata = typeof noteMetadata.$inferSelect;
export type NoteMetadataInsert = typeof noteMetadata.$inferInsert;
export type NoteContent = typeof noteContent.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Settings = typeof settings.$inferSelect;
