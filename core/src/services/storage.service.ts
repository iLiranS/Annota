import { sql } from 'drizzle-orm';
import * as FilesRepo from '../db/repositories/files.repository';
import * as FoldersRepo from '../db/repositories/folders.repository';
import * as NotesRepo from '../db/repositories/notes.repository';
import { getDb, useDbStore } from '../stores/db.store';
import { deleteFile } from './files/file.service';

type StorageStats = {
    totalFiles: number;
    totalLinks: number;
    orphans: number;
    totalFilesSize: number;
    totalNotes: number;
    totalFolders: number;
    notesSize: number;
    totalSize: number;
    dbName: string;
    freelistSize?: number;
    noteContentSize?: number;
    noteVersionsSize?: number;
    aiMessagesSize?: number;
    tableBreakdown?: Array<{ name: string; bytes: number }>;
};

export const StorageService = {
    listDatabases: async (): Promise<string[]> => {
        const { currentUserId, isGuest, isReady } = useDbStore.getState();
        if (!isReady) return [];
        const dbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;
        return [dbName];
    },

    vacuum: async (): Promise<void> => {
        const { vacuumDatabase } = await import('../db');
        await vacuumDatabase();
    },

    getStats: async (_dbNameOverride?: string): Promise<StorageStats> => {
        const { currentUserId, isGuest, isReady } = useDbStore.getState();

        if (!isReady) {
            return {
                totalFiles: 0,
                totalLinks: 0,
                orphans: 0,
                totalFilesSize: 0,
                totalNotes: 0,
                totalFolders: 0,
                notesSize: 0,
                totalSize: 0,
                dbName: 'none',
            };
        }

        const tx = getDb();
        const stats = await FilesRepo.getStorageStats(tx);
        const dbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;

        const totalNotes = await NotesRepo.getNotesCount(tx);
        const totalFolders = await FoldersRepo.getFoldersCount(tx);

        let notesSize = 0;
        let freelistSize = 0;
        let noteContentSize = 0;
        let noteVersionsSize = 0;
        let aiMessagesSize = 0;
        let tableBreakdown: Array<{ name: string; bytes: number }> = [];

        // Helper to extract the number no matter how the driver wraps it
        const extractValue = (res: any): number => {
            if (typeof res === 'number') return res; // Driver returned a raw number
            if (Array.isArray(res)) return Number(res[0]) || 0; // Driver returned an array
            if (res && typeof res === 'object') {
                // Check standard keys, then fallback to the very first value in the object
                const val = res.page_size ?? res.page_count ?? res.freelist_count ?? res.value ?? Object.values(res)[0];
                return Number(val) || 0;
            }
            return 0;
        };

        try {
            const pageSizeRes = await tx.get<any>(sql`PRAGMA page_size`);
            const pageCountRes = await tx.get<any>(sql`PRAGMA page_count`);
            const freelistCountRes = await tx.get<any>(sql`PRAGMA freelist_count`);

            const pageSize = extractValue(pageSizeRes) || 4096;
            const pageCount = extractValue(pageCountRes);
            const freelistCount = extractValue(freelistCountRes);

            notesSize = pageSize * pageCount;
            freelistSize = pageSize * freelistCount;

            // Try to get detailed table breakdown via dbstat
            try {
                const dbstatRows = await tx.all<any>(sql`
                    SELECT name, sum(pgsize) as bytes 
                    FROM dbstat 
                    GROUP BY name 
                    ORDER BY bytes DESC
                `);
                if (dbstatRows && dbstatRows.length > 0) {
                    tableBreakdown = dbstatRows.map((r: any) => {
                        const name = String(r.name ?? Object.values(r)[0]);
                        const bytes = extractValue(r.bytes ?? Object.values(r)[1]);
                        return { name, bytes };
                    });
                }
            } catch (dbstatErr) {
                // dbstat not available, which is common if SQLite wasn't compiled with SQLITE_ENABLE_DBSTAT
            }

            // Fallback/direct measurements for heavy tables
            try {
                const res = await tx.get<any>(sql`SELECT sum(length(content)) as sz FROM note_content`);
                noteContentSize = extractValue(res);
            } catch {}

            try {
                const res = await tx.get<any>(sql`SELECT sum(length(content)) as sz FROM note_versions`);
                noteVersionsSize = extractValue(res);
            } catch {}

            try {
                const res = await tx.get<any>(sql`SELECT sum(length(content) + coalesce(length(reasoning_content), 0)) as sz FROM ai_messages`);
                aiMessagesSize = extractValue(res);
            } catch {}

        } catch (e) {
            console.error('[StorageService] Failed to get DB size details:', e);
        }

        return {
            ...stats,
            totalNotes,
            totalFolders,
            notesSize,
            totalSize: stats.totalFilesSize + notesSize,
            dbName,
            freelistSize,
            noteContentSize,
            noteVersionsSize,
            aiMessagesSize,
            tableBreakdown,
        };
    },

    runGarbageCollection: async (force = false): Promise<number> => {
        await FilesRepo.deleteOrphanLinks();

        const normalizedRows = await NotesRepo.normalizeAllStoredContent();
        const deletedPaths = await FilesRepo.deleteUnreferencedFiles(undefined, force);

        let deletedCount = 0;
        for (const path of deletedPaths) {
            await deleteFile(path);
            deletedCount++;
        }

        if (normalizedRows > 0) {
            console.log(`[StorageService] Normalized ${normalizedRows} note/version rows`);
        }

        return deletedCount;
    },
};
