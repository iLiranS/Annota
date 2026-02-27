import DummySlider from '@/components/settings/dummy-slider';
import SettingItem from '@/components/settings/setting-item';
import { getEditorFontLabel } from '@/constants/editor-fonts';
import { useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EditorSettings() {
    const { colors } = useTheme();
    const { editor, updateEditorSettings } = useSettingsStore();
    const router = useRouter();

    const directionLabels: Record<string, string> = {
        'ltr': 'Left to Right',
        'rtl': 'Right to Left',
        'auto': 'Automatic'
    };

    const toggleDirection = () => {
        const next = editor.direction === 'auto' ? 'ltr' : editor.direction === 'ltr' ? 'rtl' : 'auto';
        updateEditorSettings({ direction: next });
    };

    const getDisplayValue = (value: number, defaultValue: number, step: number) => {
        const level = Math.round((value - defaultValue) / step);
        return (level > 0 ? '+' : '') + level;
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>TEXT APPEARANCE</Text>

                <DummySlider
                    label="Font Size"
                    value={Math.max(-5, Math.min(5, Math.round((editor.fontSize - 16) / 1)))}
                    minValue={-5}
                    maxValue={5}
                    step={1}
                    displayValue={getDisplayValue(editor.fontSize, 16, 1)}
                    onValueChange={(val) => updateEditorSettings({ fontSize: 16 + val })}
                />

                <DummySlider
                    label="Line Spacing"
                    value={Math.max(-5, Math.min(5, Math.round((editor.lineSpacing - 1.5) / 0.1)))}
                    minValue={-5}
                    maxValue={5}
                    step={1}
                    displayValue={getDisplayValue(editor.lineSpacing, 1.5, 0.1)}
                    onValueChange={(val) => updateEditorSettings({ lineSpacing: 1.5 + (val * 0.1) })}
                />
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>DIRECTION</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Text Direction"
                        type="value"
                        value={directionLabels[editor.direction]}
                        onPress={toggleDirection}
                        icon="swap-horizontal-outline"
                    />
                </View>
                <Text style={[styles.helperText, { color: colors.text + '60' }]}>
                    Tap to cycle between Auto, LTR, and RTL.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>FONT FAMILY</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Font"
                        type="link"
                        value={getEditorFontLabel(editor.fontFamily)}
                        onPress={() => router.push('/settings/font')}
                        icon="text"
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>LAYOUT</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Floating Note Header"
                        type="toggle"
                        value={editor.floatingNoteHeader}
                        onToggle={(val) => updateEditorSettings({ floatingNoteHeader: val })}
                        icon="text-outline"
                    />
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
    helperText: {
        fontSize: 13,
        marginTop: 8,
        marginLeft: 12,
    }
});
