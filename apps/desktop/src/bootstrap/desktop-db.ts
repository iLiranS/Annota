import { CREATE_TABLES_SQL, initDb, resetDb, useDbStore } from "@annota/core";
import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { drizzle } from "drizzle-orm/sqlite-proxy";

/** Per-user bootstrap cache — avoids re-initialising for the same user. */
const userDbCache = new Map<string, Promise<void>>();

/** The cache key that was last successfully activated. */
let activeUserKey: string | null = null;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);
}

/**
 * Initialise (or switch to) a per-user SQLite database.
 * Uses SQLCipher for encryption via Rust side invokes.
 *
 * @param skipMigrations - When true, skips DDL (CREATE TABLE / migrations).
 *   Use this for child windows that share the DB with the main window.
 *   Running DDL concurrently causes exclusive write locks on Windows,
 *   deadlocking both processes.
 */
export async function initDesktopSqlite(userId: string | null, dbKey: string, skipMigrations = false): Promise<void> {
  const cacheKey = userId ?? "__guest__";
  const dbName = userId ? `user_${userId}.db` : "local_guest.db";

  // Same user already active — nothing to do.
  if (activeUserKey === cacheKey && userDbCache.has(cacheKey)) {
    await userDbCache.get(cacheKey);
    return;
  }

  // Switching users — clear the previous Drizzle instance.
  if (activeUserKey !== null && activeUserKey !== cacheKey) {
    resetDb();
  }

  if (!userDbCache.has(cacheKey)) {
    const bootstrapPromise = (async () => {
      // 1. Resolve full path (Tauri official plugin did this automatically, we must do it manually)
      const appDataDirPath = await appDataDir();
      const fullDbPath = await join(appDataDirPath, dbName);

      // 2. Init the Rust connection pool.
      // The Rust side is idempotent: if this db path is already open it returns immediately.
      await invoke('open_encrypted_db', { 
        dbPath: fullDbPath, 
        encryptionKey: dbKey 
      });

      const TX_CONTROL_RE = /^\s*(begin|commit|rollback|savepoint|release savepoint)\b/i;

      const drizzleDb = drizzle(async (sql, params, method) => {
        try {
          if (TX_CONTROL_RE.test(sql)) return { rows: [] };

          const isReturning = /\bRETURNING\b/i.test(sql);

          // Writes
          if (method === "run" && !isReturning) {
            await invoke('execute_sql', { sql, params });
            return { rows: [] };
          }

          // Reads (returns any[][] directly from Rust)
          const result: any[][] = await invoke('select_sql', { sql, params });

          if (method === "get") {
            // Drizzle .get() expects the single row array directly
            return { rows: result[0] || [] };
          }

          // Drizzle .all() expects the array of arrays
          return { rows: result };
          
        } catch (error) {
          console.error(`[DesktopDB] Failed query: ${sql}`, params, error);
          throw error;
        }
      });

      initDb(drizzleDb as any);

      // 3. Define the native wrapper
      const nativeDbWrapper = {
        execAsync: async (rawSql: string) => {
          const statements = splitSqlStatements(rawSql);
          for (const statement of statements) {
            await invoke('execute_sql', { sql: statement, params: [] });
          }
        },
        executeRawAsync: async (sql: string) => {
          await invoke('execute_sql', { sql, params: [] });
        },
        selectAsync: async (sql: string, params: any[]) => {
          return await invoke('select_sql', { sql, params });
        }
      };

      if (!skipMigrations) {
        // Main window: run full schema setup + migrations.
        // Child windows must NOT do this — running DDL concurrently with the
        // main window's reads causes exclusive write locks on Windows.
        const { initDatabase } = await import("@annota/core");
        await initDatabase(nativeDbWrapper, drizzleDb as any);
      }

      // Register the active user in the DB store
      useDbStore.getState().initDB(userId, nativeDbWrapper);
    })();

    userDbCache.set(cacheKey, bootstrapPromise);
  }

  try {
    await userDbCache.get(cacheKey);
    activeUserKey = cacheKey;
  } catch (error) {
    userDbCache.delete(cacheKey);
    console.error("[DesktopDB] SQLite init failed:", error);
    throw error;
  }
}

export async function resetDesktopDatabase(): Promise<void> {
  // Drop FTS triggers and table first
  const ftsTriggers = [
    'notes_fts_ai',
    'notes_fts_au_content',
    'notes_fts_au_metadata',
    'notes_fts_ad'
  ];
  for (const trigger of ftsTriggers) {
    await invoke('execute_sql', { sql: `DROP TRIGGER IF EXISTS ${trigger}`, params: [] });
  }
  await invoke('execute_sql', { sql: 'DROP TABLE IF EXISTS notes_fts', params: [] });

  const tables = [
    'files',
    'version_files',
    'file_download_queue',
    'note_metadata',
    'note_content',
    'note_versions',
    'folders',
    'tags',
    'settings'
  ];

  for (const table of tables) {
    await invoke('execute_sql', { sql: `DROP TABLE IF EXISTS ${table}`, params: [] });
  }

  const statements = splitSqlStatements(CREATE_TABLES_SQL);
  for (const statement of statements) {
    await invoke('execute_sql', { sql: statement, params: [] });
  }
}
