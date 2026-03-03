import { useSettingsStore } from '@annota/core';
import { Colors } from '@annota/core/constants/theme';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

/** Subscribe to the system color-scheme media query. */
function subscribeToScheme(callback: () => void) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', callback);
    return () => mq.removeEventListener('change', callback);
}

function getSystemIsDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export interface AppTheme {
    isDark: boolean;
    accentColor: string;
    colors: {
        text: string;
        background: string;
        card: string;
        border: string;
        icon: string;
        error: string;
        errorBackground: string;
        primary: string;
    };
}

export function useAppTheme(): AppTheme {
    const systemIsDark = useSyncExternalStore(subscribeToScheme, getSystemIsDark);
    const { themeMode, accentColor } = useSettingsStore();

    const isDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

    // Keep the <html> class in sync so Tailwind dark: and shadcn vars work.
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);

    return useMemo(() => {
        const palette = Colors[isDark ? 'dark' : 'light'];
        return {
            isDark,
            accentColor,
            colors: {
                text: palette.text,
                background: palette.background,
                card: palette.card,
                border: palette.border,
                icon: palette.icon,
                error: palette.error,
                errorBackground: palette.errorBackground,
                primary: accentColor,
            },
        };
    }, [isDark, accentColor]);
}
