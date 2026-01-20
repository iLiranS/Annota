import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';
import { seedSystemData } from './seed';

// Open SQLite database
const expoDb = openDatabaseSync('notes.db');

// Create Drizzle client with schema
export const db = drizzle(expoDb, { schema });

// SQL for creating tables (CREATE TABLE IF NOT EXISTS)
const CREATE_TABLES_SQL = `
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
    note_id TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS note_versions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'folder',
    color TEXT NOT NULL DEFAULT '#F59E0B',
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
`;

// Initialize database (create tables and seed system data)
export function initDatabase(): void {
  try {
    // Create all tables
    expoDb.execSync(CREATE_TABLES_SQL);
    console.log('Database tables created successfully');

    // Run migrations for existing databases
    try {
      // Migration: Add color column to folders table if it doesn't exist
      const folderColumns = expoDb.getAllSync('PRAGMA table_info(folders)') as any[];
      const hasColorColumn = folderColumns.some((col: any) => col.name === 'color');

      if (!hasColorColumn) {
        console.log('Running migration: Adding color column to folders table');
        expoDb.execSync('ALTER TABLE folders ADD COLUMN color TEXT NOT NULL DEFAULT "#F59E0B"');

        // Update system folders with their specific colors
        expoDb.execSync(`UPDATE folders SET color = '#EF4444' WHERE id = 'system-trash'`);
        expoDb.execSync(`UPDATE folders SET color = '#F59E0B' WHERE id = 'system-daily-notes'`);

        console.log('Migration complete: color column added');
      }
    } catch (migrationError) {
      console.log('Migration check/run completed or not needed:', migrationError);
    }

    // Seed system data (Trash folder, Daily Notes folder, default settings)
    seedSystemData();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Re-export schema for convenience
export { schema };

