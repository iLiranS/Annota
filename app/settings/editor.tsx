import DummySlider from '@/components/settings/dummy-slider';
import SettingItem from '@/components/settings/setting-item';
import { useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EditorSettings() {
    const { colors } = useTheme();
    const { editor, updateEditorSettings } = useSettingsStore();

    const directionLabels: Record<string, string> = {
        'ltr': 'Left to Right',
        'rtl': 'Right to Left',
        'auto': 'Automatic'
    };

    const toggleDirection = () => {
        const next = editor.direction === 'auto' ? 'ltr' : editor.direction === 'ltr' ? 'rtl' : 'auto';
        updateEditorSettings({ direction: next });
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>TEXT APPEARANCE</Text>

                <DummySlider
                    label="Font Size"
                    value={editor.fontSize}
                    minValue={10}
                    maxValue={30}
                    step={1}
                    minLabel="Small"
                    maxLabel="Large"
                    onValueChange={(val) => updateEditorSettings({ fontSize: val })}
                />

                <DummySlider
                    label="Line Spacing"
                    value={editor.lineSpacing}
                    minValue={1.0}
                    maxValue={2.5}
                    step={0.1}
                    minLabel="Condensed"
                    maxLabel="Wide"
                    onValueChange={(val) => updateEditorSettings({ lineSpacing: val })}
                />

                <DummySlider
                    label="Paragraph Spacing"
                    value={editor.paragraphSpacing}
                    minValue={0}
                    maxValue={40}
                    step={4}
                    minLabel="None"
                    maxLabel="Large"
                    onValueChange={(val) => updateEditorSettings({ paragraphSpacing: val })}
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
                        type="value"
                        value="System (Default)"
                        // Dummy for now
                        onPress={() => { }}
                        icon="text"
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
