import { getStorageEngine, useDbStore, vacuumDatabase } from '@annota/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';

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

                    // 2. Update the last run time
                    await storage.setItem(storageKey, now.toISOString());
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
