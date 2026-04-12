import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { SortType } from '../utils/sorts';

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
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
    isPermDeleted: integer('is_perm_deleted', { mode: 'boolean' }).notNull().default(false),
});

// ============ NOTE CONTENT (heavy, lazy loaded) ============
export const noteContent = sqliteTable('note_content', {
    id: text('id').primaryKey(),
    content: text('content').notNull().default(''), // Heavy content, loaded lazily
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
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
    isPermDeleted: integer('is_perm_deleted', { mode: 'boolean' }).notNull().default(false),
});

// ============ TASKS ============
export const tasks = sqliteTable('tasks', {
    id: text('id').primaryKey(),
    title: text('title').notNull(), // Max 50 chars
    description: text('description').notNull().default(''), // Max 200 chars
    deadline: integer('deadline', { mode: 'timestamp' }).notNull(),
    isWholeDay: integer('is_whole_day', { mode: 'boolean' }).notNull().default(false),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    folderId: text('folder_id'), // Folder ID (no FK constraint)
    links: text('links').notNull().default('[]'), // JSON array of links
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
    isPermDeleted: integer('is_perm_deleted', { mode: 'boolean' }).notNull().default(false),
});

// ============ TAGS ============
export const tags = sqliteTable('tags', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(false),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
    isPermDeleted: integer('is_perm_deleted', { mode: 'boolean' }).notNull().default(false),
});


// ============ FILES (Generic: Images, PDFs, etc.) ============
export const files = sqliteTable('files', {
    id: text('id').primaryKey(),
    sourceHash: text('source_hash'),
    compressedHash: text('compressed_hash'),
    localPath: text('local_path').notNull(),
    mimeType: text('mime_type'), // e.g., 'image/webp' or 'application/pdf'
    fileType: text('file_type').notNull().default('image'), // 'image' | 'pdf' (useful for quick UI filtering)
    sizeBytes: integer('size_bytes'), // Renamed to match backend clarity
    width: integer('width'),   // Will be null for PDFs
    height: integer('height'), // Will be null for PDFs
    syncStatus: text('sync_status').notNull().default('pending'), // 'pending' | 'synced'
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ VERSION FILES (many-to-many) ============
export const versionFiles = sqliteTable('version_files', {
    versionId: text('version_id').notNull(), // Links to note_versions.id
    fileId: text('file_id').notNull(),       // Links to files.id
}, (t) => ({
    pk: primaryKey({ columns: [t.versionId, t.fileId] }),
}));

// ============ FILE DOWNLOAD QUEUE ============
export const fileDownloadQueue = sqliteTable('file_download_queue', {
    fileId: text('file_id').primaryKey(), // Ensures we don't queue duplicates
    noteId: text('note_id').notNull(),
    nonce: text('nonce').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============ SETTINGS ============
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(), // JSON
});

// ============ AI CHATS (Local Only) ============
export const aiChats = sqliteTable('ai_chats', {
    id: text('id').primaryKey(),
    title: text('title').notNull().default('New Chat'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============ AI MESSAGES (Local Only) ============
export const aiMessages = sqliteTable('ai_messages', {
    id: text('id').primaryKey(),
    chatId: text('chat_id').notNull(), // References aiChats.id
    role: text('role').$type<'system' | 'user' | 'assistant'>().notNull(),
    content: text('content').notNull(),
    model: text('model'), // The model used for this message
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// ============ TYPE EXPORTS ============
export type NoteMetadata = typeof noteMetadata.$inferSelect;
export type NoteMetadataInsert = typeof noteMetadata.$inferInsert;
export type NoteContent = typeof noteContent.$inferSelect;
export type NoteVersion = typeof noteVersions.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;

// Updated File Exports
export type FileRecord = typeof files.$inferSelect;
export type FileInsert = typeof files.$inferInsert;
export type DownloadQueueInsert = typeof fileDownloadQueue.$inferInsert;
export type DownloadQueueRecord = typeof fileDownloadQueue.$inferSelect;

// ============ APP SETTINGS ============
export const appSettings = sqliteTable('app_settings', {
    // Hardcode this to 1 so we only ever have one settings row per device
    id: integer('id').primaryKey(),
    lastSeenChangelogVersion: text('last_seen_changelog_version').default('0.0.0'),
});
export type AppSettings = typeof appSettings.$inferSelect;
export type AppSettingsInsert = typeof appSettings.$inferInsert;

export type AiChat = typeof aiChats.$inferSelect;
export type AiChatInsert = typeof aiChats.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type AiMessageInsert = typeof aiMessages.$inferInsert;
