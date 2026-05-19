import { CREATE_TABLES_SQL, initDb, resetDb, useDbStore } from "@annota/core";
import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { drizzle } from "drizzle-orm/sqlite-proxy";

interface DbCacheEntry {
  promise: Promise<void>;
  drizzleDb: any;
  nativeDbWrapper: any;
}

const userDbCache = new Map<string, DbCacheEntry>();

/** The cache key that was last successfully activated. */
let activeUserKey: string | null = null;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);
}

export async function initDesktopSqlite(userId: string | null, dbKey: string, skipMigrations = false): Promise<void> {
  const cacheKey = userId ?? "__guest__";
  const dbName = userId ? `user_${userId}.db` : "local_guest.db";

  // Same user already active in THIS JS context — nothing to do.
  if (activeUserKey === cacheKey && userDbCache.has(cacheKey)) {
    return;
  }

  // Switching users — clear the previous Drizzle instance.
  if (activeUserKey !== null && activeUserKey !== cacheKey) {
    resetDb();
    userDbCache.clear();
  }

  if (!userDbCache.has(cacheKey)) {
    let resolveReady: () => void;
    const promise = new Promise<void>((resolve) => { resolveReady = resolve; });
    
    const entry: DbCacheEntry = {
      promise,
      drizzleDb: null,
      nativeDbWrapper: null
    };
    userDbCache.set(cacheKey, entry);

    try {
      // 1. Resolve full path
      const appDataDirPath = await appDataDir();
      const fullDbPath = await join(appDataDirPath, dbName);

      // FIX: Move the polling loop entirely to JS to prevent Rust thread starvation
      if (skipMigrations) {
        let attempts = 0;
        while (attempts < 200) {
          const ready = await invoke<boolean>('is_db_ready');
          if (ready) break;
          await new Promise(r => setTimeout(r, 50));
          attempts++;
        }
        if (attempts >= 200) throw new Error("Child window timed out waiting for main window DB");
      } else {
        await invoke('open_encrypted_db', { dbPath: fullDbPath, encryptionKey: dbKey });
      }

      const TX_CONTROL_RE = /^\s*(begin|commit|rollback|savepoint|release savepoint)\b/i;
      const drizzleDb = drizzle(async (sql, params, method) => {
        try {
          if (TX_CONTROL_RE.test(sql)) return { rows: [] };
          const isReturning = /\bRETURNING\b/i.test(sql);
          if (method === "run" && !isReturning) {
            await invoke('execute_sql', { sql, params });
            return { rows: [] };
          }
          const result: any[][] = await invoke('select_sql', { sql, params });
          if (method === "get") return { rows: result[0] || [] };
          return { rows: result };
        } catch (error) {
          console.error(`[DesktopDB] Failed query: ${sql}`, params, error);
          throw error;
        }
      });

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
        const { initDatabase } = await import("@annota/core");
        await initDatabase(nativeDbWrapper, drizzleDb as any);
      }

      entry.drizzleDb = drizzleDb;
      entry.nativeDbWrapper = nativeDbWrapper;
      resolveReady!();
    } catch (error) {
      userDbCache.delete(cacheKey);
      throw error;
    }
  }

  const entry = userDbCache.get(cacheKey)!;
  await entry.promise;

  // Re-register with the global runtime and store
  initDb(entry.drizzleDb);
  useDbStore.getState().initDB(userId, entry.nativeDbWrapper);
  activeUserKey = cacheKey;
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
