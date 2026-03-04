import { drizzle } from 'drizzle-orm/sqlite-proxy';
import Database from '@tauri-apps/plugin-sql';
import * as schema from '@annota/core/src/db/schema';

async function run() {
    const db = await Database.load('sqlite:test.db');
    await db.execute(
        `CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            hash TEXT,
            local_path TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER,
            width INTEGER,
            height INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL
        );`
    );

    const drizzleDb = drizzle(async (sql, params, method) => {
        try {
            const bindParams = params.length > 0 ? params : undefined;
            if (method === "run") {
                await db.execute(sql, bindParams);
                return { rows: [] };
            } else {
                const result = await db.select<any[]>(sql, bindParams);
                return { rows: result.map((row) => Object.values(row)) };
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    });

    try {
        const image = {
            id: 'test-123',
            localPath: '/tmp/test',
            size: 100,
            syncStatus: 'synced' as const,
            createdAt: new Date(),
        };
        const res = await drizzleDb.insert(schema.images).values(image).returning().get();
        console.log("INSERT RESULT:", res);
        
        const count = await drizzleDb.select().from(schema.images);
        console.log("COUNT:", count.length);
    } catch(err) {
        console.log("INSERT ERROR:", err);
    }
}
run();
