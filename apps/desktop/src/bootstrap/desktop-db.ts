import { CREATE_TABLES_SQL, initDb, resetDb, useDbStore } from "@annota/core";
import Database from "@tauri-apps/plugin-sql";
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
 *
 * `tauri-plugin-sql` resolves the relative `sqlite:` URI to the correct
 * sandboxed Application Support directory automatically, so we only need to
 * vary the filename per user.
 */
export async function initDesktopSqlite(userId: string | null): Promise<void> {
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
      const db = await Database.load(`sqlite:${dbName}`);

      // tauri-plugin-sql uses sqlx with a connection pool — each execute() call
      // may hit a different connection, so SQL-level transactions (BEGIN/COMMIT/ROLLBACK)
      // cannot work across separate IPC calls. We skip them and rely on auto-commit.
      const TX_CONTROL_RE =
        /^\s*(begin|commit|rollback|savepoint|release savepoint)\b/i;

      const drizzleDb = drizzle(async (sql, params, method) => {
        try {
          // Skip transaction control statements — they can't work across IPC calls.
          if (TX_CONTROL_RE.test(sql)) {
            return { rows: [] };
          }

          // tauri-plugin-sql expects undefined or non-empty arrays for bind values.
          const bindParams = params.length > 0 ? params : undefined;

          // Detect if the query expects data back (e.g. INSERT ... RETURNING *)
          const isReturning = /\bRETURNING\b/i.test(sql);

          // Pure write with no returning clause — execute and discard.
          if (method === "run" && !isReturning) {
            await db.execute(sql, bindParams);
            return { rows: [] };
          }

          // Read query OR write-with-RETURNING — fetch the rows.
          const result = await db.select<Record<string, unknown>[]>(
            sql,
            bindParams,
          );

          // Drizzle's mapResultRow accesses values by column *index* (row[columnIndex]),
          // so we must convert objects → arrays. Object.values() preserves insertion
          // order in V8/JSC, and tauri-plugin-sql returns keys in SQLite's column order
          // which matches Drizzle's schema field order.

          if (method === "get") {
            // For .get(), Drizzle expects `rows` to be the single row directly,
            // NOT wrapped in an outer array.
            return { rows: result[0] ? Object.values(result[0]) : [] };
          }

          // For .all() / .values() / write-with-RETURNING
          return { rows: result.map((row) => Object.values(row)) };
        } catch (error) {
          console.error(`[DesktopDB] Failed query: ${sql}`, params, error);
          throw error;
        }
      });

      initDb(drizzleDb as any);
      await db.execute("PRAGMA journal_mode = WAL;");
      await db.execute("PRAGMA foreign_keys = ON;");

      // Keep desktop schema aligned with core's SQLite bootstrap SQL.
      const statements = splitSqlStatements(CREATE_TABLES_SQL);
      for (const statement of statements) {
        await db.execute(statement);
      }

      // Register the active user in the DB store and provide an Expo SQLite-compatible nativeDb wrapper
      useDbStore.getState().initDB(userId, {
        execAsync: async (rawSql: string) => {
          // Tauri's db.execute doesn't support multiple statements separated by ';' directly
          const statements = splitSqlStatements(rawSql);
          for (const statement of statements) {
            await db.execute(statement);
          }
        }
      });
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
  const userId = activeUserKey === "__guest__" ? null : activeUserKey;
  const dbName = userId ? `user_${userId}.db` : "local_guest.db";

  const db = await Database.load(`sqlite:${dbName}`);

  const tables = [
    'files',
    'version_files',
    'file_download_queue',
    'note_metadata',
    'note_content',
    'note_versions',
    'folders',
    'tasks',
    'tags',
    'settings'
  ];


  for (const table of tables) {
    await db.execute(`DROP TABLE IF EXISTS ${table}`);
  }

  const statements = splitSqlStatements(CREATE_TABLES_SQL);
  for (const statement of statements) {
    await db.execute(statement);
  }
}
