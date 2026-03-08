import { eq, inArray } from 'drizzle-orm';
import { getStorageEngine } from '../stores/config';
import { getDb } from './runtime';
import * as schema from './schema';
import { seedSystemData } from './seed';
import type { DbType } from './types';

// SQL for creating tables (CREATE TABLE IF NOT EXISTS)
export const CREATE_TABLES_SQL = `
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
export async function initDatabase(nativeDb: { execAsync: (sql: string) => Promise<void> }, drizzleDb: DbType): Promise<void> {
  try {
    // Create all tables
    await nativeDb.execAsync(CREATE_TABLES_SQL);

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
  const { getExpoDb, getDb, useDbStore } = await import('../stores/db.store');
  const nativeDb = getExpoDb() as { execAsync: (sql: string) => Promise<void> };
  const drizzleDb = getDb();
  const userId = useDbStore.getState().currentUserId;

  try {
    // 1. Stop background sync activity to prevent "database is locked" errors
    const { SyncScheduler } = await import('../sync/sync-scheduler');
    SyncScheduler.instance?.dispose();

    // Yield the event loop to allow pending SQLite promises to finish executing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Sign out user and clear auth stores BEFORE clearing storage
    // If we clear storage first, the Supabase client may fail to sign out properly
    const { useUserStore } = await import('../stores/user.store');
    await useUserStore.getState().signOut();

    // Reset sync store states explicitly
    const { useSyncStore } = await import('../stores/sync.store');
    useSyncStore.getState().setLastSyncAt(new Date(0));
    useSyncStore.getState().clearAesKey();

    // 2. Clear sync pointers explicitly before clearing all storage
    const storage = getStorageEngine();
    if (userId) {
      const syncTimeKey = `${userId}_last_sync_time`;
      await storage.removeItem(syncTimeKey);
      console.log(`[Reset] Cleared sync pointer for ${userId}`);
    }

    if (typeof storage.clear === 'function') {
      await storage.clear();
      console.log('Storage cleared');
    }

    // 3. Batch the drops into a single statement
    // This requires only ONE lock acquisition instead of fighting for it 8 times in a loop.
    const dropStatements = `
      DROP TABLE IF EXISTS note_images;
      DROP TABLE IF EXISTS images;
      DROP TABLE IF EXISTS note_metadata;
      DROP TABLE IF EXISTS note_content;
      DROP TABLE IF EXISTS note_versions;
      DROP TABLE IF EXISTS folders;
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS version_images;
    `;

    // Disable foreign key constraints temporarily so tables can be dropped in any order
    await nativeDb.execAsync('PRAGMA foreign_keys = OFF;');
    await nativeDb.execAsync(dropStatements);
    await nativeDb.execAsync('PRAGMA foreign_keys = ON;');

    console.log('All tables dropped successfully');

    await initDatabase(nativeDb, drizzleDb);

    // Re-init stores so UI reflects the wiped database
    const { useNotesStore } = await import('../stores/notes.store');
    const { useTasksStore } = await import('../stores/tasks.store');
    await useNotesStore.getState().initApp();
    await useTasksStore.getState().loadTasks();
  } catch (error) {
    console.error('App reset failed:', error);
    throw error;
  }
}

// Reclaim unused space and optimize database performance
export async function vacuumDatabase(): Promise<void> {
  try {
    const { getExpoDb } = await import('../stores/db.store');
    const nativeDb = getExpoDb() as { execAsync: (sql: string) => Promise<void> };

    await nativeDb.execAsync('VACUUM;');
    console.log('Database vacuumed successfully');
  } catch (error: any) {
    const errMsg = error.message || '';

    // Catch active readers, active writers, and open transactions
    if (
      errMsg.includes('database is locked') ||
      errMsg.includes('transaction') ||
      errMsg.includes('SQL statements in progress')
    ) {
      console.log('[StorageService] Vacuum skipped gracefully: Database is currently active/reading.');
    } else {
      console.error('Database vacuum failed with unexpected error:', error);
    }
  }
}

/**
 * Hard deletes all items marked with isPermDeleted=true, only for guest users.
 * Guest users don't sync, so they don't need to keep tombstones.
 */
export async function purgeGuestTombstones(): Promise<void> {
  try {
    const { useDbStore } = await import('../stores/db.store');
    const isGuest = useDbStore.getState().isGuest;
    if (!isGuest) return;

    const drizzleDb = getDb();

    await drizzleDb.transaction(async (tx: any) => {
      // 1. Get IDs of notes to purge for cascading cleanup
      const purgedNotes = await tx.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isPermDeleted, true))
        .all();

      // Convert results to flat array of strings
      const noteIds = purgedNotes.map((n: any) => n.id);

      if (noteIds.length > 0) {
        // A. Content cleanup
        await tx.delete(schema.noteContent)
          .where(inArray(schema.noteContent.id, noteIds))
          .run();

        // B. Version history cleanup
        const versions = await tx.select({ id: schema.noteVersions.id })
          .from(schema.noteVersions)
          .where(inArray(schema.noteVersions.noteId, noteIds))
          .all();

        const versionIds = versions.map((v: any) => v.id);

        if (versionIds.length > 0) {
          await tx.delete(schema.versionImages)
            .where(inArray(schema.versionImages.versionId, versionIds))
            .run();
          await tx.delete(schema.noteVersions)
            .where(inArray(schema.noteVersions.id, versionIds))
            .run();
        }

        // C. Final Note Metadata cleanup
        await tx.delete(schema.noteMetadata)
          .where(inArray(schema.noteMetadata.id, noteIds))
          .run();
      }

      // 2. Folders cleanup
      await tx.delete(schema.folders)
        .where(eq(schema.folders.isPermDeleted, true))
        .run();

      // 3. Tasks cleanup
      await tx.delete(schema.tasks)
        .where(eq(schema.tasks.isPermDeleted, true))
        .run();
    });

    console.log('[Maintenance] Guest tombstones purged');
  } catch (error) {
    console.error('[Maintenance] Purge failed:', error);
  }
}

// Re-export schema for convenience
export { schema };

// Remove master key from secure storage
export async function resetMasterKey(userId: string): Promise<void> {
  const { removeMasterKey } = await import('../utils/crypto');
  try {
    if (userId) {
      await removeMasterKey(userId);
    }
    console.log('SecureStore cleared for master key');
  } catch (error) {
    console.error('Failed to reset master key:', error);
    throw error;
  }
}
