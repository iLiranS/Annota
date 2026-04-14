import { eq, inArray } from 'drizzle-orm';
import { getStorageEngine } from '../stores/config';
import { getDb, getExpoDb, useDbStore } from '../stores/db.store';
import { useSyncStore } from '../stores/sync.store';
import { useUserStore } from '../stores/user.store';
import { SyncScheduler } from '../sync/sync-scheduler';
import { removeMasterKey } from '../utils/crypto';
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


  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_dirty INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    is_perm_deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    last_seen_changelog_version TEXT DEFAULT '0.0.0'
  );


  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    source_hash TEXT,
    compressed_hash TEXT,
    local_path TEXT NOT NULL,
    mime_type TEXT,
    file_type TEXT NOT NULL DEFAULT 'image',
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS version_files (
    version_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    PRIMARY KEY (version_id, file_id)
  );

  -- Indices for better performance
  CREATE INDEX IF NOT EXISTS idx_note_metadata_updated_at ON note_metadata(updated_at);
  CREATE INDEX IF NOT EXISTS idx_note_metadata_folder_id ON note_metadata(folder_id);
  CREATE INDEX IF NOT EXISTS idx_files_source_hash ON files(source_hash);
  CREATE INDEX IF NOT EXISTS idx_files_compressed_hash ON files(compressed_hash);
  CREATE INDEX IF NOT EXISTS idx_version_files_version_id ON version_files(version_id);
  CREATE INDEX IF NOT EXISTS idx_version_files_file_id ON version_files(file_id);
  
  CREATE TABLE IF NOT EXISTS file_download_queue (
    file_id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    nonce TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS ai_chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    current_context_id TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at INTEGER NOT NULL
  );
`;

// Initialize database (create tables and seed system data)
export async function initDatabase(
  nativeDb: { 
    execAsync: (sql: string) => Promise<void>,
    selectAsync?: (sql: string, params: any[]) => Promise<any[]>
  }, 
  drizzleDb: DbType
): Promise<void> {
  try {
    // 1. Create all base tables using IF NOT EXISTS
    await nativeDb.execAsync(CREATE_TABLES_SQL);

    // 2. Migration Tracker Setup
    await nativeDb.execAsync(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);

    // 3. Define Migrations
    const migrations = [
      {
        name: '001_add_current_context_id',
        sql: 'ALTER TABLE ai_chats ADD COLUMN current_context_id TEXT;'
      },
      {
        name: '002_remove_tasks_table',
        sql: 'DROP TABLE IF EXISTS tasks;'
      }
    ];

    // 4. Execute Migrations
    if (nativeDb.selectAsync) {
      for (const m of migrations) {
        const alreadyApplied = await nativeDb.selectAsync(
          'SELECT id FROM _migrations WHERE name = ?',
          [m.name]
        );

        if (!alreadyApplied || alreadyApplied.length === 0) {
          try {
            await nativeDb.execAsync(m.sql);
            await nativeDb.execAsync(
              `INSERT INTO _migrations (name, applied_at) VALUES ('${m.name}', ${Date.now()});`
            );
            console.log(`[DB] Applied migration: ${m.name}`);
          } catch (e: any) {
            const errorMsg = (e?.message || String(e)).toLowerCase();
            // If the column already exists (from a previous ad-hoc attempt), just record it
            if (errorMsg.includes('duplicate column name') || errorMsg.includes('already exists')) {
               await nativeDb.execAsync(
                `INSERT INTO _migrations (name, applied_at) VALUES ('${m.name}', ${Date.now()});`
              );
            } else {
              console.error(`[DB] Migration failed: ${m.name}`, e);
            }
          }
        }
      }
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

  const nativeDb = getExpoDb() as { execAsync: (sql: string) => Promise<void> };
  const drizzleDb = getDb();
  const userId = useDbStore.getState().currentUserId;

  try {
    // 1. Stop background sync activity to prevent "database is locked" errors
    SyncScheduler.instance?.dispose();

    // Yield the event loop to allow pending SQLite promises to finish executing
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Reset sync state — clears both in-memory store AND the persisted sync pointer.
    //    Done BEFORE signOut because signOut triggers side-effects (on mobile, the auth
    //    listener re-bootstraps the DB to a guest context, invalidating our DB refs).
    if (userId) {
      await useSyncStore.getState().resetForUser(userId);
    } else {
      useSyncStore.getState().reset();
    }

    // 3. Drop and recreate tables WHILE our DB references are still valid.
    //    signOut() must come AFTER this because it triggers onAuthStateChange which
    //    may switch the active database (e.g. to guest), invalidating nativeDb/drizzleDb.
    const dropStatements = `
      DROP TABLE IF EXISTS files;
      DROP TABLE IF EXISTS note_metadata;
      DROP TABLE IF EXISTS note_content;
      DROP TABLE IF EXISTS note_versions;
      DROP TABLE IF EXISTS folders;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS app_settings;
      DROP TABLE IF EXISTS version_files;
      DROP TABLE IF EXISTS file_download_queue;
      DROP TABLE IF EXISTS ai_chats;
      DROP TABLE IF EXISTS ai_messages;
    `;

    await nativeDb.execAsync('PRAGMA foreign_keys = OFF;');
    await nativeDb.execAsync(dropStatements);
    await nativeDb.execAsync('PRAGMA foreign_keys = ON;');
    console.log('All tables dropped successfully');

    await initDatabase(nativeDb, drizzleDb);

    // 4. Clear all persistent storage (AsyncStorage / Tauri Store)
    const storage = getStorageEngine();
    if (typeof storage.clear === 'function') {
      await storage.clear();
      console.log('Storage cleared');
    }

    // 5. Sign out LAST — this triggers onAuthStateChange listeners which may
    //    re-bootstrap the app (switch DB, re-route, etc.). All destructive
    //    work must already be done by this point.
    //    Wrapped in try/catch because storage.clear() may have already removed
    //    the Supabase session token, causing signOut to fail. That's fine —
    //    server-side token revocation is best-effort; local state is already wiped.
    try {
      await useUserStore.getState().signOut();
    } catch (signOutError) {
      console.warn('[Reset] signOut failed (expected if storage was cleared first):', signOutError);
    }
  } catch (error) {
    console.error('App reset failed:', error);
    throw error;
  }
}

/**
 * Completely wipes all local SQL tables.
 * Used during account deletion to ensure no trace is left.
 */
export async function deleteDatabase(): Promise<void> {
  const nativeDb = getExpoDb() as { execAsync: (sql: string) => Promise<void> };

  try {
    // 1. Stop background sync activity
    SyncScheduler.instance?.dispose();

    // Yield to let any pending SQLite operations finish
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Batch the drops into a single statement
    const dropStatements = `
      DROP TABLE IF EXISTS files;
      DROP TABLE IF EXISTS note_metadata;
      DROP TABLE IF EXISTS note_content;
      DROP TABLE IF EXISTS note_versions;
      DROP TABLE IF EXISTS folders;
      DROP TABLE IF EXISTS tags;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS app_settings;
      DROP TABLE IF EXISTS version_files;
      DROP TABLE IF EXISTS file_download_queue;
      DROP TABLE IF EXISTS ai_chats;
      DROP TABLE IF EXISTS ai_messages;
    `;

    // Disable foreign key constraints temporarily
    await nativeDb.execAsync('PRAGMA foreign_keys = OFF;');
    await nativeDb.execAsync(dropStatements);
    await nativeDb.execAsync('PRAGMA foreign_keys = ON;');

    console.log('Local database tables dropped successfully');
  } catch (error) {
    console.error('Delete database failed:', error);
    throw error;
  }
}

// Reclaim unused space and optimize database performance
export async function vacuumDatabase(): Promise<void> {
  try {
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
          await tx.delete(schema.versionFiles)
            .where(inArray(schema.versionFiles.versionId, versionIds))
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
