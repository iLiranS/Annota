import { getStorageEngine, useDbStore, vacuumDatabase } from '@annota/core';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readDir, remove } from '@tauri-apps/plugin-fs';
import { useEffect } from 'react';

async function cleanupPdfExportCache() {
    try {
        const cacheDir = await appCacheDir();
        const entries = await readDir(cacheDir);
        for (const entry of entries) {
            if (entry.isFile && entry.name.startsWith('annota_export_') && entry.name.endsWith('.html')) {
                const filePath = await join(cacheDir, entry.name);
                await remove(filePath);
            }
        }
        console.log("[DAILY_CLEANUP] PDF export cache cleared successfully");
    } catch (error) {
        console.error("[DAILY_CLEANUP] Failed to clear PDF export cache:", error);
    }
}

export function useDailyCleanup() {
    const isReady = useDbStore(state => state.isReady);

    useEffect(() => {
        if (!isReady) return;

        // Only run daily cleanup on the main window
        if (getCurrentWindow().label !== 'main') return;

        const checkAndRunCleanup = async () => {
            const { currentUserId, isGuest } = useDbStore.getState();

            try {
                const prefix = isGuest ? 'guest' : `user_${currentUserId}`;
                const storageKey = `${prefix}_last_cleanup_date`;

                const storage = getStorageEngine();
                const lastRunStr = await storage.getItem(storageKey);
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
                    await vacuumDatabase();

                    // 2. Clean up temporary PDF export files in the cache directory
                    await cleanupPdfExportCache();

                    // 3. Update the last run time
                    await storage.setItem(storageKey, now.toISOString());
                    console.log("[DAILY_CLEANUP] Daily cleanup completed successfully");
                }
            } catch (error) {
                console.error("[DAILY_CLEANUP] Failed to run daily cleanup", error);
            }
        };

        // Run when isReady becomes true
        void checkAndRunCleanup();

        // Also check when window regains focus
        const handleFocus = () => {
            void checkAndRunCleanup();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [isReady]);
}
