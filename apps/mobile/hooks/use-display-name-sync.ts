import { useDbStore } from '@annota/core';
import { useUserStore } from '@annota/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useDisplayNameSync() {
    const { user, isGuest, initialized, getDisplayName, updateDisplayName } = useUserStore();
    const isDbReady = useDbStore(state => state.isReady);

    useEffect(() => {
        const checkAndSyncDisplayName = async () => {
            if (!initialized || isGuest || !user || !isDbReady) return;

            try {
                const storageKey = `user_${user.id}_last_display_name_sync`;
                const lastRunStr = await AsyncStorage.getItem(storageKey);
                const now = new Date();

                let shouldRun = false;
                if (!lastRunStr) {
                    shouldRun = true;
                } else {
                    const lastRun = new Date(lastRunStr);
                    const timeDiff = now.getTime() - lastRun.getTime();
                    if (timeDiff > 24 * 60 * 60 * 1000) {
                        shouldRun = true;
                    }
                }

                if (shouldRun) {
                    const backendDisplayName = await getDisplayName();

                    if (!backendDisplayName) {
                        const metadata = user.user_metadata || {};
                        const nameToUse = metadata.full_name || metadata.name || metadata.preferred_username || 'Guest';
                        await updateDisplayName(nameToUse);
                    } else if (user.user_metadata?.display_name !== backendDisplayName) {
                        await updateDisplayName(backendDisplayName);
                    }

                    await AsyncStorage.setItem(storageKey, now.toISOString());
                }
            } catch (error) {
                console.error("[DISPLAY_NAME_SYNC] Failed to run sync", error);
            }
        };

        checkAndSyncDisplayName();

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                checkAndSyncDisplayName();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [user, isGuest, initialized, isDbReady, getDisplayName, updateDisplayName]);
}
