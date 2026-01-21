import { COLOR_PALETTE } from '@/constants/colors';
import { ThemeMode, useSettingsStore } from '@/stores/settings-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ThemeSettings() {
    const { colors } = useTheme();
    const { themeMode, setThemeMode, accentColor, setAccentColor } = useSettingsStore();

    const themes: { label: string; mode: ThemeMode; icon: keyof typeof Ionicons.glyphMap }[] = [
        { label: 'Light', mode: 'light', icon: 'sunny-outline' },
        { label: 'Dark', mode: 'dark', icon: 'moon-outline' },
        { label: 'System', mode: 'system', icon: 'hardware-chip-outline' },
    ];

    const insets = useSafeAreaInsets();

    // ...

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>APP THEME</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    {themes.map((theme, index) => (
                        <Pressable
                            key={theme.mode}
                            style={({ pressed }) => [
                                styles.themeOption,
                                { borderBottomWidth: index < themes.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border + '20' },
                                pressed && { backgroundColor: colors.border + '10' }
                            ]}
                            onPress={() => setThemeMode(theme.mode)}
                        >
                            <View style={styles.themeInfo}>
                                <Ionicons name={theme.icon} size={22} color={colors.text} />
                                <Text style={[styles.themeLabel, { color: colors.text }]}>{theme.label}</Text>
                            </View>
                            {themeMode === theme.mode && (
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            )}
                        </Pressable>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>ACCENT COLOR</Text>
                <View style={[styles.accentGrid, { backgroundColor: colors.card }]}>
                    {COLOR_PALETTE.map((colorOption) => {
                        const colorValue = colorOption.value; // Fix for Reanimated warning
                        return (
                            <Pressable
                                key={colorValue}
                                style={[
                                    styles.colorButton,
                                    { backgroundColor: colorValue },
                                    accentColor === colorValue && styles.selectedColor
                                ]}
                                onPress={() => setAccentColor(colorValue)}
                            >
                                {accentColor === colorValue && (
                                    <Ionicons name="checkmark" size={18} color="#FFF" />
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 12,
        letterSpacing: 0.5,
    },
    card: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    themeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    themeLabel: {
        fontSize: 16,
    },
    accentGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
        borderRadius: 12,
        justifyContent: 'center',
    },
    colorButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedColor: {
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    }
});
