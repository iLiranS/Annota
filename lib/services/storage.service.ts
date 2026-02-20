import { vacuumDatabase } from '@/lib/db/client';
import * as ImagesRepo from '@/lib/db/repositories/images.repository';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { deleteImageFile } from './images/image.service';

export const StorageService = {
    getStats: async () => {
        const stats = ImagesRepo.getStorageStats();

        let notesSize = 0;
        try {
            const dbDir = new Directory(Paths.document, 'SQLite');

            const dbFile = new ExpoFile(dbDir, 'notes.db');
            if (dbFile.exists) notesSize += dbFile.size;

            const walFile = new ExpoFile(dbDir, 'notes.db-wal');
            if (walFile.exists) notesSize += walFile.size;

            const shmFile = new ExpoFile(dbDir, 'notes.db-shm');
            if (shmFile.exists) notesSize += shmFile.size;
        } catch (e) {
            console.error('Failed to get database size:', e);
        }

        return {
            ...stats,
            notesSize,
            totalSize: stats.totalImagesSize + notesSize
        };
    },

    runGarbageCollection: (force = false) => {
        // Clean up invalid links first (so their referenced images might become orphans)
        ImagesRepo.deleteOrphanLinks();

        const deletedPaths = ImagesRepo.deleteUnreferencedImages(undefined, force);
        let deletedCount = 0;
        for (const path of deletedPaths) {
            deleteImageFile(path);
            deletedCount++;
        }

        // Reclaim raw DB space and shrink WAL file now that images/data are deleted
        vacuumDatabase();

        return deletedCount;
    }
};
