import { useSettingsStore } from '@annota/core';
import { EDITOR_FONTS, getEditorFontOption } from '@annota/core/constants/editor-fonts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FontSettings() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { editor, updateEditorSettings } = useSettingsStore();
    const selectedId = getEditorFontOption(editor.fontFamily)?.id ?? 'system';

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>FONT FAMILY</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    {EDITOR_FONTS.map((option, index) => (
                        <Pressable
                            key={option.id}
                            style={({ pressed }) => [
                                styles.option,
                                { borderBottomWidth: index < EDITOR_FONTS.length - 1 ? StyleSheet.hairlineWidth : 0 },
                                { borderBottomColor: colors.border + '20' },
                                pressed && { backgroundColor: colors.border + '10' },
                            ]}
                            onPress={() => updateEditorSettings({ fontFamily: option.id })}
                        >
                            <View style={styles.optionInfo}>
                                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                                <Text
                                    style={[
                                        styles.previewText,
                                        { color: colors.text + '80' },
                                        { fontFamily: option.fontFamily }
                                    ]}
                                >
                                    The quick brown fox
                                </Text>
                            </View>
                            {selectedId === option.id && (
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            )}
                        </Pressable>
                    ))}
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
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    optionInfo: {
        flex: 1,
        paddingRight: 12,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    previewText: {
        marginTop: 4,
        fontSize: 13,
    },
});
