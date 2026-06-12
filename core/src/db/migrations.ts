export const MIGRATIONS = [
  {
    name: '008_add_publish_fields',
    sql: [
      'ALTER TABLE note_metadata ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE note_metadata ADD COLUMN publish_updated_at INTEGER;'
    ]
  },
  {
    name: '009_add_last_synced_file_ids',
    sql: "ALTER TABLE note_metadata ADD COLUMN last_synced_file_ids TEXT NOT NULL DEFAULT '[]';"
  },
  {
    name: '010_convert_fts_to_external_content_v3',
    sql: [
      `DROP TRIGGER IF EXISTS notes_fts_ai;`,
      `DROP TRIGGER IF EXISTS notes_fts_au_content;`,
      `DROP TRIGGER IF EXISTS notes_fts_au_metadata;`,
      `DROP TRIGGER IF EXISTS notes_fts_ad;`,
      `DROP TRIGGER IF EXISTS notes_fts_bd;`,
      `DROP TRIGGER IF EXISTS notes_fts_bu_content;`,
      `DROP TRIGGER IF EXISTS notes_fts_bu_metadata;`,
      `DROP TABLE IF EXISTS notes_fts;`,
      `DROP VIEW IF EXISTS note_search_view;`,
      `CREATE VIEW IF NOT EXISTS note_search_view AS SELECT c.rowid AS rowid, m.id AS id, m.title AS title, m.preview AS preview, c.content AS content FROM note_metadata m JOIN note_content c ON m.id = c.id;`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(id UNINDEXED, title, preview, content, content='note_search_view');`,
      `CREATE TRIGGER IF NOT EXISTS notes_fts_ai AFTER INSERT ON note_content BEGIN INSERT INTO notes_fts(rowid, id, title, preview, content) SELECT new.rowid, new.id, m.title, m.preview, new.content FROM note_metadata m WHERE m.id = new.id; END;`,
      `CREATE TRIGGER IF NOT EXISTS notes_fts_bd BEFORE DELETE ON note_content BEGIN INSERT INTO notes_fts(notes_fts, rowid, id, title, preview, content) SELECT 'delete', old.rowid, old.id, m.title, m.preview, old.content FROM note_metadata m WHERE m.id = old.id; END;`,
      `CREATE TRIGGER IF NOT EXISTS notes_fts_bu_content BEFORE UPDATE ON note_content BEGIN INSERT INTO notes_fts(notes_fts, rowid, id, title, preview, content) SELECT 'delete', old.rowid, old.id, m.title, m.preview, old.content FROM note_metadata m WHERE m.id = old.id; END;`,
      `CREATE TRIGGER IF NOT EXISTS notes_fts_au_content AFTER UPDATE ON note_content BEGIN INSERT INTO notes_fts(rowid, id, title, preview, content) SELECT new.rowid, new.id, m.title, m.preview, new.content FROM note_metadata m WHERE m.id = new.id; END;`,
      `CREATE TRIGGER IF NOT EXISTS notes_fts_bu_metadata BEFORE UPDATE OF title, preview ON note_metadata BEGIN INSERT INTO notes_fts(notes_fts, rowid, id, title, preview, content) SELECT 'delete', c.rowid, old.id, old.title, old.preview, c.content FROM note_content c WHERE c.id = old.id; END;`,
      `CREATE TRIGGER IF NOT EXISTS notes_fts_au_metadata AFTER UPDATE OF title, preview ON note_metadata BEGIN INSERT INTO notes_fts(rowid, id, title, preview, content) SELECT c.rowid, new.id, new.title, new.preview, c.content FROM note_content c WHERE c.id = new.id; END;`,
      `INSERT INTO notes_fts(notes_fts) VALUES('rebuild');`
    ]
  }
];

export async function runMigrations(
  nativeDb: {
    execAsync: (sql: string) => Promise<void>,
    executeRawAsync?: (sql: string) => Promise<void>,
    selectAsync?: (sql: string, params: any[]) => Promise<any[]>
  }
): Promise<void> {
  await nativeDb.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  if (nativeDb.selectAsync) {
    for (const m of MIGRATIONS) {
      const alreadyApplied = await nativeDb.selectAsync(
        'SELECT id FROM _migrations WHERE name = ?',
        [m.name]
      );

      if (!alreadyApplied || alreadyApplied.length === 0) {
        try {
          const statements = Array.isArray(m.sql) ? m.sql : [m.sql];
          for (const stmt of statements) {
            if (nativeDb.executeRawAsync) {
              await nativeDb.executeRawAsync(stmt);
            } else {
              await nativeDb.execAsync(stmt);
            }
          }
          await nativeDb.execAsync(
            `INSERT INTO _migrations (name, applied_at) VALUES ('${m.name}', ${Date.now()});`
          );
          console.log(`[DB] Applied migration: ${m.name}`);
        } catch (e: any) {
          const errorMsg = (e?.message || String(e)).toLowerCase();
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
}
