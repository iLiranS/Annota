import { vacuumDatabase } from '../db';
import * as ImagesRepo from '../db/repositories/images.repository';
import * as NotesRepo from '../db/repositories/notes.repository';
import { useDbStore } from '../stores/db.store';
import { deleteImageFile } from './images/image.service';

type StorageStats = {
    totalImages: number;
    totalLinks: number;
    orphans: number;
    totalImagesSize: number;
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
                notesSize: 0,
                totalSize: 0,
                dbName: 'none',
            };
        }

        const stats = await ImagesRepo.getStorageStats();
        const dbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;

        return {
            ...stats,
            notesSize: 0,
            totalSize: stats.totalImagesSize,
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

        vacuumDatabase();

        if (normalizedRows > 0) {
            console.log(`[StorageService] Normalized ${normalizedRows} note/version rows`);
        }

        return deletedCount;
    },
};
