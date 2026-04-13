import SettingItem from '@/components/settings/setting-item';
import { useSettingsStore } from '@annota/core';
import { useTheme } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function GeneralSettings() {
    const { colors } = useTheme();
    const { general, updateGeneralSettings } = useSettingsStore();

    const toggleStartOfWeek = () => {
        updateGeneralSettings({
            startOfWeek: general.startOfWeek === 'sunday' ? 'monday' : 'sunday'
        });
    };



    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>CALENDAR & DATE</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Start Week On"
                        type="value"
                        value={general.startOfWeek === 'sunday' ? 'Sunday' : 'Monday'}
                        onPress={toggleStartOfWeek}
                        icon="calendar-outline"
                    />
                </View>
            </View>



            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>DISPLAY</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Compact Mode"
                        type="toggle"
                        value={general.compactMode}
                        onToggle={(val) => updateGeneralSettings({ compactMode: val })}
                        icon="list-outline"
                        description="Show more items in lists"
                    />
                    <SettingItem
                        label="Haptic Feedback"
                        type="toggle"
                        value={general.hapticFeedback}
                        onToggle={(val) => updateGeneralSettings({ hapticFeedback: val })}
                        icon="finger-print-outline"
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
});
