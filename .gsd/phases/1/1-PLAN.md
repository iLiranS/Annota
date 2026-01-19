---
phase: 1
plan: 1
wave: 1
depends_on: []
files_modified:
  - package.json
  - lib/db/schema.ts
  - lib/db/client.ts
  - drizzle.config.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "expo-sqlite and drizzle-orm are installed"
    - "Drizzle schema defines all tables from SPEC.md"
    - "note_metadata and note_content are separate tables"
  artifacts:
    - "lib/db/schema.ts exists with complete schema"
    - "lib/db/client.ts exports initialized Drizzle client"
---

# Plan 1.1: Install Dependencies & Create Drizzle Schema

<objective>
Set up the SQLite database foundation with expo-sqlite and Drizzle ORM.

Purpose: Establish the data layer that will replace in-memory dummy data with persistent local storage.
Output: Drizzle schema with all tables, database client ready for use.
</objective>

<context>
Load for context:
- .gsd/SPEC.md (Database Schema section, lines 40-84)
- .gsd/ARCHITECTURE.md
- dev-data/data.ts (existing type definitions)
- package.json
</context>

<tasks>

<task type="auto">
  <name>Install database dependencies</name>
  <files>package.json</files>
  <action>
    Install required packages:
    ```bash
    pnpm add expo-sqlite drizzle-orm
    pnpm add -D drizzle-kit
    ```
    
    AVOID: Do NOT install `better-sqlite3` or `sql.js` — we're using `expo-sqlite` which is the Expo-native solution.
    AVOID: Do NOT install `@libsql/client` — that's for Turso, we use local SQLite only.
  </action>
  <verify>pnpm list expo-sqlite drizzle-orm drizzle-kit shows all packages installed</verify>
  <done>All 3 packages appear in package.json dependencies/devDependencies</done>
</task>

<task type="auto">
  <name>Create Drizzle schema with data split</name>
  <files>lib/db/schema.ts</files>
  <action>
    Create `lib/db/schema.ts` with Drizzle table definitions:
    
    ```typescript
    import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
    
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
      noteId: text('note_id').primaryKey().references(() => noteMetadata.id, { onDelete: 'cascade' }),
      content: text('content').notNull().default(''),
    });
    
    // ============ NOTE VERSIONS ============
    export const noteVersions = sqliteTable('note_versions', {
      id: text('id').primaryKey(),
      noteId: text('note_id').notNull().references(() => noteMetadata.id, { onDelete: 'cascade' }),
      content: text('content').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    });
    
    // ============ FOLDERS ============
    export const folders = sqliteTable('folders', {
      id: text('id').primaryKey(),
      parentId: text('parent_id'),
      name: text('name').notNull(),
      icon: text('icon').notNull().default('folder'),
      sortType: text('sort_type').notNull().default('UPDATED_LAST'),
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
    ```
    
    AVOID: Do NOT use `integer` for IDs — use `text` for consistency with existing cuid-style IDs.
    AVOID: Do NOT forget `{ mode: 'timestamp' }` for Date columns.
    AVOID: Do NOT forget `{ mode: 'boolean' }` for boolean columns — SQLite uses integers.
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit lib/db/schema.ts</verify>
  <done>Schema file compiles, all 7 tables defined with proper types</done>
</task>

<task type="auto">
  <name>Create database client module</name>
  <files>lib/db/client.ts</files>
  <action>
    Create `lib/db/client.ts` that:
    
    ```typescript
    import { drizzle } from 'drizzle-orm/expo-sqlite';
    import { openDatabaseSync } from 'expo-sqlite';
    import * as schema from './schema';
    
    // Open SQLite database
    const expoDb = openDatabaseSync('notes.db');
    
    // Create Drizzle client
    export const db = drizzle(expoDb, { schema });
    
    // Initialize database (create tables if not exist)
    export async function initDatabase(): Promise<void> {
      // Create tables using raw SQL (Drizzle migrations are complex for RN)
      expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS note_metadata (
          id TEXT PRIMARY KEY,
          folder_id TEXT,
          title TEXT NOT NULL DEFAULT 'Untitled Note',
          preview TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at INTEGER,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          is_quick_access INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          original_folder_id TEXT
        );
        
        CREATE TABLE IF NOT EXISTS note_content (
          note_id TEXT PRIMARY KEY REFERENCES note_metadata(id) ON DELETE CASCADE,
          content TEXT NOT NULL DEFAULT ''
        );
        
        CREATE TABLE IF NOT EXISTS note_versions (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL REFERENCES note_metadata(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          parent_id TEXT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'folder',
          sort_type TEXT NOT NULL DEFAULT 'UPDATED_LAST',
          is_system INTEGER NOT NULL DEFAULT 0,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at INTEGER,
          original_parent_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          deadline INTEGER NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          linked_note_id TEXT,
          created_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      
      console.log('Database initialized successfully');
    }
    
    export { schema };
    ```
    
    AVOID: Do NOT use drizzle-kit push/migrate for React Native — use execSync with CREATE TABLE IF NOT EXISTS.
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit lib/db/client.ts</verify>
  <done>lib/db/client.ts exports db client and initDatabase function</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `pnpm list expo-sqlite drizzle-orm` shows packages installed
- [ ] `lib/db/schema.ts` exists and compiles
- [ ] `lib/db/client.ts` exports db and initDatabase
- [ ] note_metadata and note_content are separate tables
</verification>

<success_criteria>
- [ ] All dependencies installed
- [ ] Drizzle schema compiles
- [ ] Database client module ready
- [ ] Data split architecture in place
</success_criteria>
