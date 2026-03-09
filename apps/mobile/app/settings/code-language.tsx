import { useSettingsStore } from '@annota/core';
import { CODE_LANGUAGES } from '@annota/editor-web/extensions';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CodeLanguageSettings() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { editor, updateEditorSettings } = useSettingsStore();

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>DEFAULT LANGUAGE</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    {CODE_LANGUAGES.map((option, index) => (
                        <Pressable
                            key={option.value || 'auto'}
                            style={({ pressed }) => [
                                styles.option,
                                { borderBottomWidth: index < CODE_LANGUAGES.length - 1 ? StyleSheet.hairlineWidth : 0 },
                                { borderBottomColor: colors.border + '20' },
                                pressed && { backgroundColor: colors.border + '10' },
                            ]}
                            onPress={() => updateEditorSettings({ defaultCodeLanguage: option.value })}
                        >
                            <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                            {editor.defaultCodeLanguage === option.value && (
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            )}
                        </Pressable>
                    ))}
                </View>
                <Text style={[styles.helperText, { color: colors.text + '60' }]}>
                    Choose the language that will be automatically selected for new code blocks.
                </Text>
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
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    helperText: {
        fontSize: 13,
        marginTop: 12,
        marginLeft: 12,
        lineHeight: 18,
    }
});
