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

      const drizzleDb = drizzle(async (sql, params, method) => {
        if (method === "run") {
          await db.execute(sql, params);
          return { rows: [] };
        } else {
          const result = await db.select<any[]>(sql, params);
          return { rows: result };
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
