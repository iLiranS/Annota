import * as LegacyFileSystem from 'expo-file-system/legacy';
import { type SQLiteDatabase } from 'expo-sqlite';
import { getStorageEngine } from '../stores/config';
import * as schema from './schema';
import { seedSystemData } from './seed';
import type { DbType } from './types';

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
    links TEXT NOT NULL DEFAULT '[]',
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
      // migrations here - I deleted for now as no need
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
  const { getExpoDb, getDb } = require('../stores/db.store');
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

    const storage = getStorageEngine();
    if (typeof storage.clear === 'function') {
      await storage.clear();
      console.log('Storage cleared');
    }



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

    // Re-init stores so UI reflects the wiped database
    const { useNotesStore } = require('../stores/notes.store');
    const { useTasksStore } = require('../stores/tasks.store');
    useNotesStore.getState().initApp();
    useTasksStore.getState().loadTasks();
  } catch (error) {
    console.error('App reset failed:', error);
    throw error;
  }
}

// Reclaim unused space and optimize database performance
export function vacuumDatabase(): void {
  try {
    const { getExpoDb } = require('../stores/db.store');
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
  const { removeMasterKey, removeLegacyMasterKey } = require('../utils/crypto');
  try {
    if (userId) {
      await removeMasterKey(userId);
    }
    if (typeof removeLegacyMasterKey === 'function') {
      await removeLegacyMasterKey();
    }
    console.log('SecureStore cleared for master key');
  } catch (error) {
    console.error('Failed to reset master key:', error);
    throw error;
  }
}
