import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settings-store';
import { DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { useMemo } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export function useAppTheme(): Theme {
    const systemScheme = useNativeColorScheme();
    const { themeMode, accentColor } = useSettingsStore();

    const scheme = themeMode === 'system' ? systemScheme : themeMode;
    const isDark = scheme === 'dark';
    const BaseTheme = isDark ? DarkTheme : DefaultTheme;

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
            },
        };
    }, [isDark, accentColor, BaseTheme]);
}

export function useAppColorScheme() {
    const systemScheme = useNativeColorScheme();
    const { themeMode } = useSettingsStore();
    return themeMode === 'system' ? systemScheme : themeMode;
}
