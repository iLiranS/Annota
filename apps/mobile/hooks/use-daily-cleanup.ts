import { useDbStore, useSettingsStore, vacuumDatabase } from '@annota/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

export function useDailyCleanup() {
    useEffect(() => {
        const checkAndRunCleanup = async () => {
            const { currentUserId, isGuest, isReady } = useDbStore.getState();
            if (!isReady) return;

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
                    await vacuumDatabase();

                    // 2. Update the last run time
                    await AsyncStorage.setItem(storageKey, now.toISOString());
                }
            } catch (error) {
                console.error("[DAILY_CLEANUP] Failed to run daily cleanup", error);
            }
        };

        // Run on initial app load
        checkAndRunCleanup();


    }, []);
}
