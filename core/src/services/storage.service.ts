import { sql } from 'drizzle-orm';
import { vacuumDatabase } from '../db';
import * as FoldersRepo from '../db/repositories/folders.repository';
import * as ImagesRepo from '../db/repositories/images.repository';
import * as NotesRepo from '../db/repositories/notes.repository';
import * as TasksRepo from '../db/repositories/tasks.repository';
import { getDb, useDbStore } from '../stores/db.store';
import { deleteImageFile } from './images/image.service';

type StorageStats = {
    totalImages: number;
    totalLinks: number;
    orphans: number;
    totalImagesSize: number;
    totalNotes: number;
    totalTasks: number;
    totalFolders: number;
    notesSize: number;
    totalSize: number;
    dbName: string;
};

export const StorageService = {
    listDatabases: async (): Promise<string[]> => {
        const { currentUserId, isGuest, isReady } = useDbStore.getState();
        if (!isReady) return [];
        const dbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;
        return [dbName];
    },

    getStats: async (_dbNameOverride?: string): Promise<StorageStats> => {
        const { currentUserId, isGuest, isReady } = useDbStore.getState();

        if (!isReady) {
            return {
                totalImages: 0,
                totalLinks: 0,
                orphans: 0,
                totalImagesSize: 0,
                totalNotes: 0,
                totalTasks: 0,
                totalFolders: 0,
                notesSize: 0,
                totalSize: 0,
                dbName: 'none',
            };
        }

        const tx = getDb();
        const stats = await ImagesRepo.getStorageStats(tx);
        const dbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;

        const totalNotes = await NotesRepo.getNotesCount(tx);
        const totalTasks = await TasksRepo.getTasksCount(tx);
        const totalFolders = await FoldersRepo.getFoldersCount(tx);

        // Get DB size using SQLite pragmas
        let notesSize = 0;
        try {
            const pageSizeRes = await tx.get<{ value: number }>(sql`SELECT page_size as value FROM pragma_page_size`);
            const pageCountRes = await tx.get<{ value: number }>(sql`SELECT page_count as value FROM pragma_page_count`);
            if (pageSizeRes && pageCountRes) {
                notesSize = pageSizeRes.value * pageCountRes.value;
            }
        } catch (e) {
            console.error('[StorageService] Failed to get DB size:', e);
        }

        return {
            ...stats,
            totalNotes,
            totalTasks,
            totalFolders,
            notesSize,
            totalSize: stats.totalImagesSize + notesSize,
            dbName,
        };
    },

    runGarbageCollection: async (force = false): Promise<number> => {
        await ImagesRepo.deleteOrphanLinks();

        const normalizedRows = await NotesRepo.normalizeAllStoredContent();
        const deletedPaths = await ImagesRepo.deleteUnreferencedImages(undefined, force);

        let deletedCount = 0;
        for (const path of deletedPaths) {
            await deleteImageFile(path);
            deletedCount++;
        }

        await vacuumDatabase();

        if (normalizedRows > 0) {
            console.log(`[StorageService] Normalized ${normalizedRows} note/version rows`);
        }

        return deletedCount;
    },
};
