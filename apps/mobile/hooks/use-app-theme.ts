import { useSettingsStore } from '@annota/core';
import { Colors } from '@annota/core/constants/theme';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';


export type AppTheme = Theme & {
    colors: Theme['colors'] & {
        error: string;
        errorBackground: string;
    };
};

export function useAppTheme(): AppTheme {
    const systemScheme = useNativeColorScheme();
    const { themeMode, accentColor } = useSettingsStore();

    const scheme = themeMode === 'system' ? systemScheme : themeMode;
    const isDark = scheme === 'dark';
    const BaseTheme = isDark ? DarkTheme : DefaultTheme;

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.style.setProperty("--accent", accentColor + "65");
            root.style.setProperty("--accent-full", accentColor);

            // Helpful as an alternative selector in CSS/Web
            root.classList.toggle("dark", isDark);
            root.setAttribute("data-theme", isDark ? "dark" : "light");
        }
    }, [isDark, accentColor]);

    return useMemo(() => {
        const customColors = Colors[isDark ? 'dark' : 'light'];

        return {
            ...BaseTheme,
            colors: {
                ...BaseTheme.colors,
                primary: accentColor,
                background: customColors.background,
                text: customColors.text,
                card: customColors.card,
                border: customColors.border,
                error: customColors.error,
                errorBackground: customColors.errorBackground,
            },
        };
    }, [isDark, accentColor, BaseTheme]);
}

export function useAppColorScheme() {
    const systemScheme = useNativeColorScheme();
    const { themeMode } = useSettingsStore();
    return themeMode === 'system' ? systemScheme : themeMode;
}
