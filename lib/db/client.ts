import AsyncStorage from '@react-native-async-storage/async-storage';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { type SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';
import { seedSystemData } from './seed';

// Dummy instance for types
const _dummyDb = drizzle({} as any as SQLiteDatabase, { schema });

// Create Drizzle client with schema
export type DbType = typeof _dummyDb;
export type TxType = Parameters<Parameters<typeof _dummyDb.transaction>[0]>[0];
export type DbOrTx = DbType | TxType;

// SQL for creating tables (CREATE TABLE IF NOT EXISTS)
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS note_metadata (
    id TEXT PRIMARY KEY,
    folder_id TEXT,
    title TEXT NOT NULL DEFAULT 'Untitled Note' CHECK(length(title) <= 50),
    preview TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_quick_access INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    original_folder_id TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    is_perm_deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS note_content (
    id TEXT PRIMARY KEY,
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
    name TEXT NOT NULL CHECK(length(name) <= 50),
    icon TEXT NOT NULL DEFAULT 'folder',
    color TEXT NOT NULL DEFAULT '#F59E0B',
    sort_type TEXT NOT NULL DEFAULT 'UPDATED_LAST',
    is_system INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    original_parent_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_dirty INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    is_perm_deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(title) <= 50),
    description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 200),
    deadline INTEGER NOT NULL,
    is_whole_day INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    folder_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_dirty INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    is_perm_deleted INTEGER NOT NULL DEFAULT 0
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

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    hash TEXT,
    local_path TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    width INTEGER,
    height INTEGER,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS version_images (
    version_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    PRIMARY KEY (version_id, image_id)
  );

  -- Indices for better performance
  CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
  CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  CREATE INDEX IF NOT EXISTS idx_note_metadata_updated_at ON note_metadata(updated_at);
  CREATE INDEX IF NOT EXISTS idx_note_metadata_folder_id ON note_metadata(folder_id);
  CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
  CREATE INDEX IF NOT EXISTS idx_version_images_version_id ON version_images(version_id);
  CREATE INDEX IF NOT EXISTS idx_version_images_image_id ON version_images(image_id);
`;

// Initialize database (create tables and seed system data)
export function initDatabase(expoDb: SQLiteDatabase, drizzleDb: DbType): void {
  try {
    // Create all tables
    expoDb.execSync(CREATE_TABLES_SQL);

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
        expoDb.execSync(`UPDATE folders SET color = '#8B5CF6' WHERE id = 'system-daily-notes'`);

        console.log('Migration complete: color column added');
      }

      // Migration: Add is_whole_day column to tasks table if it doesn't exist
      const taskColumns = expoDb.getAllSync('PRAGMA table_info(tasks)') as any[];
      const hasIsWholeDayColumn = taskColumns.some((col: any) => col.name === 'is_whole_day');

      if (!hasIsWholeDayColumn) {
        console.log('Running migration: Adding is_whole_day column to tasks table');
        expoDb.execSync('ALTER TABLE tasks ADD COLUMN is_whole_day INTEGER NOT NULL DEFAULT 0');
        console.log('Migration complete: is_whole_day column added');
      }

      // Migration: Add completed_at column to tasks table if it doesn't exist
      const hasCompletedAtColumn = taskColumns.some((col: any) => col.name === 'completed_at');

      if (!hasCompletedAtColumn) {
        console.log('Running migration: Adding completed_at column to tasks table');
        expoDb.execSync('ALTER TABLE tasks ADD COLUMN completed_at INTEGER');

        // Backfill completed_at with updatedAt for currently completed tasks
        expoDb.execSync('UPDATE tasks SET completed_at = updated_at WHERE completed = 1');
        console.log('Migration complete: completed_at column added');
      }

      // Migration: Add is_perm_deleted column to note_metadata, folders, and tasks
      const noteColumns = expoDb.getAllSync('PRAGMA table_info(note_metadata)') as any[];
      const hasNotePermDeleted = noteColumns.some((col: any) => col.name === 'is_perm_deleted');
      if (!hasNotePermDeleted) {
        console.log('Running migration: Adding is_perm_deleted columns');
        expoDb.execSync('ALTER TABLE note_metadata ADD COLUMN is_perm_deleted INTEGER NOT NULL DEFAULT 0');
        expoDb.execSync('ALTER TABLE folders ADD COLUMN is_perm_deleted INTEGER NOT NULL DEFAULT 0');
        expoDb.execSync('ALTER TABLE tasks ADD COLUMN is_perm_deleted INTEGER NOT NULL DEFAULT 0');
        console.log('Migration complete: is_perm_deleted columns added');
      }
    } catch (migrationError) {
      console.log('Migration check/run completed or not needed:', migrationError);
    }

    // Seed system data (Trash folder, Daily Notes folder, default settings)
    seedSystemData(drizzleDb);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Reset everything (DB, Storage, Files) - USE WITH CAUTION
export async function resetAll(): Promise<void> {
  const { getExpoDb, getDb } = require('@/stores/db-store');
  const expoDb = getExpoDb();
  const drizzleDb = getDb();
  try {
    const tables = [
      'note_images',
      'images',
      'note_metadata',
      'note_content',
      'note_versions',
      'folders',
      'tasks',
      'tags',
      'settings'
    ];

    tables.forEach(table => {
      expoDb.execSync(`DROP TABLE IF EXISTS ${table}`);
    });

    console.log('All tables dropped successfully');

    // Clear async storage
    await AsyncStorage.clear();
    console.log('AsyncStorage cleared');



    // Clear FileSystem (except SQLite)
    if (LegacyFileSystem.documentDirectory) {
      const dir = await LegacyFileSystem.readDirectoryAsync(LegacyFileSystem.documentDirectory);
      for (const file of dir) {
        if (file !== 'SQLite') {
          await LegacyFileSystem.deleteAsync(LegacyFileSystem.documentDirectory + file, { idempotent: true });
        }
      }
      console.log('FileSystem cleared');
    }

    initDatabase(expoDb, drizzleDb);
  } catch (error) {
    console.error('App reset failed:', error);
    throw error;
  }
}

// Reclaim unused space and optimize database performance
export function vacuumDatabase(): void {
  try {
    const { getExpoDb } = require('@/stores/db-store');
    const expoDb = getExpoDb();
    // Force WAL checkpoint to shrink WAL file
    expoDb.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
    // Vacuum to reclaim deleted space in the main database
    expoDb.execSync('VACUUM;');
    console.log('Database vacuumed successfully');
  } catch (error) {
    console.error('Database vacuum failed:', error);
  }
}

// Re-export schema for convenience
export { schema };

// Remove master key from secure storage
export async function resetMasterKey(userId: string): Promise<void> {
  const { removeMasterKey, removeLegacyMasterKey } = require('@/lib/utils/crypto');
  try {
    if (userId) {
      await removeMasterKey(userId);
    }
    await removeLegacyMasterKey();
    console.log('SecureStore cleared for master key');
  } catch (error) {
    console.error('Failed to reset master key:', error);
    throw error;
  }
}
