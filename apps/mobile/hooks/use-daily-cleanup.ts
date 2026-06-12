import { StorageService, useDbStore } from '@annota/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory as ExpoDirectory, File as ExpoFile, Paths } from 'expo-file-system';
import { useEffect } from 'react';

async function cleanupExportCache() {
    try {
        const cacheDir = Paths.cache;
        if (cacheDir.exists) {
            const entries = cacheDir.list();
            for (const entry of entries) {
                // 1. Clean up Markdown exports (.md files)
                if (entry instanceof ExpoFile && entry.name.endsWith('.md')) {
                    try {
                        entry.delete();
                        console.log(`[DAILY_CLEANUP] Deleted markdown cache file: ${entry.name}`);
                    } catch (err) {
                        console.error(`[DAILY_CLEANUP] Failed to delete file ${entry.name}:`, err);
                    }
                }

                // 2. Clean up PDF print folders (created by expo-print)
                if (entry instanceof ExpoDirectory && entry.name === 'Print') {
                    try {
                        entry.delete();
                        console.log("[DAILY_CLEANUP] Deleted PDF Print cache directory");
                    } catch (err) {
                        console.error(`[DAILY_CLEANUP] Failed to delete Print dir:`, err);
                    }
                }

                // 3. Clean up orphaned downloads folder
                if (entry instanceof ExpoDirectory && entry.name === 'downloads') {
                    try {
                        entry.delete();
                        console.log("[DAILY_CLEANUP] Deleted downloads cache directory");
                    } catch (err) {
                        console.error(`[DAILY_CLEANUP] Failed to delete downloads dir:`, err);
                    }
                }
            }
            console.log("[DAILY_CLEANUP] Mobile export cache cleared successfully");
        }
    } catch (error) {
        console.error("[DAILY_CLEANUP] Failed to clear mobile export cache:", error);
    }
}

export function useDailyCleanup() {
    const isReady = useDbStore(state => state.isReady);

    useEffect(() => {
        if (!isReady) return;

        const checkAndRunCleanup = async () => {
            const { currentUserId, isGuest } = useDbStore.getState();

            try {
                const prefix = isGuest ? 'guest' : `user_${currentUserId}`;
                const storageKey = `${prefix}_last_task_cleanup_date`;

                const lastRunStr = await AsyncStorage.getItem(storageKey);
                const now = new Date();

                let shouldRun = false;
                if (!lastRunStr) {
                    shouldRun = true;
                } else {
                    const lastRun = new Date(lastRunStr);
                    // Check if 24 hours have passed
                    const timeDiff = now.getTime() - lastRun.getTime();
                    if (timeDiff > 24 * 60 * 60 * 1000) {
                        shouldRun = true;
                    }
                }

                if (shouldRun) {
                    // 1. Vacuum the database to reclaim space
                    // await vacuumDatabase();

                    // 2. Clean up temporary export/download files
                    await cleanupExportCache();

                    // 3. Run garbage collection to remove orphaned files from disk
                    //    (covers files deleted from notes before they were synced, etc.)
                    try {
                        const deleted = await StorageService.runGarbageCollection();
                        if (deleted > 0) {
                            console.log(`[DAILY_CLEANUP] GC removed ${deleted} orphaned file(s)`);
                        }
                    } catch (gcErr) {
                        console.error('[DAILY_CLEANUP] GC failed:', gcErr);
                    }

                    // 4. Update the last run time
                    await AsyncStorage.setItem(storageKey, now.toISOString());
                    console.log("[DAILY_CLEANUP] Daily cleanup completed successfully");
                }
            } catch (error) {
                console.error("[DAILY_CLEANUP] Failed to run daily cleanup", error);
            }
        };

        // Run when isReady becomes true
        checkAndRunCleanup();

    }, [isReady]);
}


