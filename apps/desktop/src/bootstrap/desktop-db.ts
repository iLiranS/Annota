import { CREATE_TABLES_SQL, initDb } from "@annota/core";
import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";

let sqliteBootstrapPromise: Promise<void> | null = null;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);
}

export async function initDesktopSqlite(): Promise<void> {
  if (!sqliteBootstrapPromise) {
    sqliteBootstrapPromise = (async () => {
      const db = await Database.load("sqlite:annota.db");

      // tauri-plugin-sql uses sqlx with a connection pool — each execute() call
      // may hit a different connection, so SQL-level transactions (BEGIN/COMMIT/ROLLBACK)
      // cannot work across separate IPC calls. We skip them and rely on auto-commit.
      const TX_CONTROL_RE = /^\s*(begin|commit|rollback|savepoint|release savepoint)\b/i;

      const drizzleDb = drizzle(async (sql, params, method) => {
        try {
          // Skip transaction control statements — they can't work across IPC calls.
          if (TX_CONTROL_RE.test(sql)) {
            return { rows: [] };
          }

          // tauri-plugin-sql expects undefined or non-empty arrays for bind values.
          const bindParams = params.length > 0 ? params : undefined;

          if (method === "run") {
            await db.execute(sql, bindParams);
            return { rows: [] };
          } else {
            const result = await db.select<any[]>(sql, bindParams);
            return { rows: result.map((row) => Object.values(row)) };
          }
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
    })();
  }

  try {
    await sqliteBootstrapPromise;
  } catch (error) {
    sqliteBootstrapPromise = null;
    console.error("[DesktopDB] SQLite init failed:", error);
    throw error;
  }
}
