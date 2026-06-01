import { useAppTheme } from './use-app-theme';
import { useSyncStore, useUserStore } from '@annota/core';
import { useCallback, useState } from 'react';
import {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

interface UsePullToSyncOptions {
    onRefresh?: () => Promise<void>;
    top?: number;
}

export function usePullToSync({ onRefresh, top }: UsePullToSyncOptions = {}) {
    const { colors } = useAppTheme();
    const isSyncing = useSyncStore(state => state.isSyncing);
    const { isGuest } = useUserStore();
    const [localRefreshing, setLocalRefreshing] = useState(false);
    const scrollY = useSharedValue(0);

    const showSpinner = isSyncing || localRefreshing;

    const triggerSync = useCallback(async () => {
        setLocalRefreshing(true);
        try {
            await Promise.all([
                onRefresh ? onRefresh() : Promise.resolve(),
                !isGuest ? useSyncStore.getState().forceSync() : Promise.resolve()
            ]);
        } catch (e) {
            console.error('[Manual Sync]', e);
        } finally {
            setLocalRefreshing(false);
        }
    }, [isGuest, onRefresh]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { scrollY.value = event.contentOffset.y; },
        onEndDrag: (event) => {
            if (event.contentOffset.y < -80) runOnJS(triggerSync)();
        },
    });

    const syncIndicatorStyle = useAnimatedStyle(() => {
        if (isGuest) return { opacity: 0 };
        const pullProgress = interpolate(scrollY.value, [-80, 0], [1, 0], Extrapolation.CLAMP);
        return {
            position: 'absolute', top: 0, left: 0, height: 2, zIndex: 1000,
            width: isSyncing ? '100%' : `${pullProgress * 100}%`,
            backgroundColor: colors.primary,
            opacity: isSyncing ? withTiming(1) : (pullProgress > 0 ? 1 : 0),
        };
    });

    const spinnerStyle = useAnimatedStyle(() => {
        const bypassGuest = !onRefresh && isGuest;
        if (bypassGuest) return { opacity: 0 };

        return {
            position: 'absolute',
            top: top ?? 20,
            left: '50%',
            zIndex: 1001,
            transform: [
                { translateX: -16 },
                { scale: showSpinner ? withTiming(1) : withTiming(0) }
            ],
            opacity: showSpinner ? withTiming(1) : withTiming(0),
        };
    });

    return {
        scrollY,
        scrollHandler,
        isSyncing: showSpinner,
        syncIndicatorStyle,
        spinnerStyle,
        triggerSync
    };
}
