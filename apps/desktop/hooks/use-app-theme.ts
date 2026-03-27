import { useSettingsStore } from '@annota/core';
import { Colors } from '@annota/core/constants/theme';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';

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
    const [hasHydrated, setHasHydrated] = useState(
        useSettingsStore.persist.hasHydrated()
    );

    useEffect(() => {
        if (hasHydrated) return;
        return useSettingsStore.persist.onFinishHydration(() => {
            setHasHydrated(true);
        });
    }, [hasHydrated]);

    const isDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';
    const effectiveIsDark =
        hasHydrated
            ? isDark
            : typeof document !== "undefined" && document.documentElement.classList.contains("dark");

    // Keep the <html> class and CSS variables in sync so Tailwind and shadcn vars work.
    const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

    useIsomorphicLayoutEffect(() => {

        if (!hasHydrated) return;
        
        const root = document.documentElement;
        const body = document.body;

        const applyTheme = () => {
            root.classList.toggle("dark", isDark);
            body.classList.toggle("dark", isDark);
            
            // Helpful as an alternative selector in CSS
            root.setAttribute("data-theme", isDark ? "dark" : "light");
            body.setAttribute("data-theme", isDark ? "dark" : "light");


            root.style.setProperty("--accent", accentColor + "65");
            root.style.setProperty("--accent-full", accentColor);

            // subtle background tint
            root.style.setProperty(
                "--accent-soft",
                `color-mix(in oklch, ${accentColor} 12%, var(--background))`
            );

            root.style.setProperty(
                "--accent-soft-hover",
                `color-mix(in oklch, ${accentColor} 18%, var(--background))`
            );
        };

        applyTheme();

        try {
            localStorage.setItem("annota.themeMode", themeMode);
            localStorage.setItem("annota.accentColor", accentColor);
        } catch {
            // Ignore storage failures
        }
    }, [isDark, accentColor, themeMode, hasHydrated]);

    return useMemo(() => {
        const palette = Colors[effectiveIsDark ? 'dark' : 'light'];
        return {
            isDark: effectiveIsDark,
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
