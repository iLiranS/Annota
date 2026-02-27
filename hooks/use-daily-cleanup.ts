import { useSettingsStore } from '@/stores/settings-store';
import { useTasksStore } from '@/stores/tasks-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const LAST_CLEANUP_KEY = 'last_task_cleanup_date';

export function useDailyCleanup() {
    useEffect(() => {
        const checkAndRunCleanup = async () => {
            try {
                const lastRunStr = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
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
                    useTasksStore.getState().clearOldCompletedTasks(cutoffDate);

                    // 4. Update the last run time
                    await AsyncStorage.setItem(LAST_CLEANUP_KEY, now.toISOString());
                }
            } catch (error) {
                console.error("[DAILY_CLEANUP] Failed to run daily cleanup", error);
            }
        };

        // Run on initial app load
        checkAndRunCleanup();

        // Optional: Also check when the app comes back from the background
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                checkAndRunCleanup();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);
}
