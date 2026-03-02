import { vacuumDatabase } from '../db';
import * as ImagesRepo from '../db/repositories/images.repository';
import * as NotesRepo from '../db/repositories/notes.repository';
import { useDbStore } from '../stores/db.store';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';
import { deleteImageFile } from './images/image.service';

export const StorageService = {
    listDatabases: async () => {
        try {
            const dbDir = new Directory(Paths.document, 'SQLite').uri;
            const files = await LegacyFileSystem.readDirectoryAsync(dbDir);
            return files.filter(f => f.endsWith('.db'));
        } catch (e) {
            console.error('Failed to list databases:', e);
            return [];
        }
    },

    getStats: async (dbNameOverride?: string) => {
        const { currentUserId, isGuest, isReady } = useDbStore.getState();

        let dbName = dbNameOverride;
        if (!dbName) {
            if (!isReady) {
                return {
                    totalImages: 0,
                    totalLinks: 0,
                    orphans: 0,
                    totalImagesSize: 0,
                    notesSize: 0,
                    totalSize: 0,
                    dbName: 'none'
                };
            }
            dbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;
        }

        const activeDbName = isGuest ? 'local_guest.db' : `user_${currentUserId}.db`;
        let stats;

        if (dbName === activeDbName) {
            stats = ImagesRepo.getStorageStats();
        } else {
            // Fetch stats for non-active DB using raw SQLite
            try {
                const db = openDatabaseSync(dbName);
                const imagesCount = db.getFirstSync<{ count: number }>('SELECT count(*) as count FROM images')?.count ?? 0;
                const linksCount = db.getFirstSync<{ count: number }>('SELECT count(*) as count FROM version_images')?.count ?? 0;
                const imagesSize = db.getFirstSync<{ sum: number }>('SELECT sum(size) as sum FROM images')?.sum ?? 0;
                const orphansCount = db.getFirstSync<{ count: number }>(
                    'SELECT count(*) as count FROM images WHERE id NOT IN (SELECT image_id FROM version_images)'
                )?.count ?? 0;

                stats = {
                    totalImages: imagesCount,
                    totalLinks: linksCount,
                    orphans: orphansCount,
                    totalImagesSize: imagesSize
                };
            } catch (error) {
                console.error(`Failed to get stats for ${dbName}:`, error);
                stats = { totalImages: 0, totalLinks: 0, orphans: 0, totalImagesSize: 0 };
            }
        }

        let notesSize = 0;
        try {
            const dbDir = new Directory(Paths.document, 'SQLite');

            const dbFile = new ExpoFile(dbDir, dbName);
            if (dbFile.exists) notesSize += dbFile.size;

            const walFile = new ExpoFile(dbDir, `${dbName}-wal`);
            if (walFile.exists) notesSize += walFile.size;

            const shmFile = new ExpoFile(dbDir, `${dbName}-shm`);
            if (shmFile.exists) notesSize += shmFile.size;
        } catch (e) {
            console.error('Failed to get database size:', e);
        }

        return {
            ...stats,
            notesSize,
            totalSize: stats.totalImagesSize + notesSize,
            dbName
        };
    },

    runGarbageCollection: (force = false) => {
        // ... (remaining code unchanged)
        // Clean up invalid links first (so their referenced images might become orphans)
        ImagesRepo.deleteOrphanLinks();

        // Normalize old note/version rows that still embed heavy image src payloads.
        const normalizedRows = NotesRepo.normalizeAllStoredContent();

        const deletedPaths = ImagesRepo.deleteUnreferencedImages(undefined, force);
        let deletedCount = 0;
        for (const path of deletedPaths) {
            deleteImageFile(path);
            deletedCount++;
        }

        // Reclaim raw DB space and shrink WAL file now that images/data are deleted
        vacuumDatabase();

        if (normalizedRows > 0) {
            console.log(`[StorageService] Normalized ${normalizedRows} note/version rows`);
        }

        return deletedCount;
    }
};
