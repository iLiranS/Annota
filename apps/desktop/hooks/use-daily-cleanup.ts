import { getStorageEngine, useDbStore, useSettingsStore, useTasksStore, vacuumDatabase } from '@annota/core';
import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

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
                const storageKey = `${prefix}_last_task_cleanup_date`;

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
                    // 1. Get the user's setting (7, 30, 90, 180) from your settings store
                    const { general } = useSettingsStore.getState();
                    const daysToKeep = general.autoClearTasksDays || 30;

                    // 2. Calculate the cutoff date
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

                    // 3. Run your store function
                    await useTasksStore.getState().clearOldCompletedTasks(cutoffDate);

                    // 4. Vacuum the database to reclaim space
                    await vacuumDatabase();

                    // 5. Update the last run time
                    await storage.setItem(storageKey, now.toISOString());
                }

                // --- DAILY STATUS SENTENCES CLEARANCE ---
                const sentenceKey = `${prefix}_daily_status_sentences`;
                const lastSentenceUpdateKey = `${prefix}_last_status_sentence_update`;
                const lastSentenceStr = await storage.getItem(lastSentenceUpdateKey);
                const lastSentenceUpdate = lastSentenceStr ? new Date(lastSentenceStr) : null;

                if (!lastSentenceUpdate || lastSentenceUpdate.toDateString() !== now.toDateString()) {
                    // Just clear it so the UI picks a fresh one
                    await storage.removeItem(sentenceKey);
                    await storage.setItem(lastSentenceUpdateKey, now.toISOString());
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
