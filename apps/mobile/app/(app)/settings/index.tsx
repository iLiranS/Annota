import SettingItem from '@/components/settings/setting-item';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsIndex() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>PREFERENCES</Text>

                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Appearance"
                        icon="color-palette-outline"
                        onPress={() => router.push('/settings/theme')}
                        description="Theme, accent color"
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#007AFF"
                    />
                    <SettingItem
                        label="Editor"
                        icon="text-outline"
                        onPress={() => router.push('/settings/editor')}
                        description="Font, spacing, direction"
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#5856D6"
                    />
                    <SettingItem
                        label="General"
                        icon="options-outline"
                        onPress={() => router.push('/settings/general')}
                        description="Start of week, view options"
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#8E8E93"
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>ACCOUNT</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Account"
                        icon="person-circle-outline"
                        onPress={() => router.push('/settings/account')}
                        description="Profile and sign in options"
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#34C759"
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>SYSTEM</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Storage & Debug"
                        icon="server-outline"
                        onPress={() => router.push('/settings/storage')}
                        description="Manage files and cache"
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#FF9500"
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>SUPPORT</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Help & Support"
                        icon="help-circle-outline"
                        onPress={() => router.push('/settings/help')}
                        description="Contact us, Discord, and more"
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#8E8E93"
                    />
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={[styles.versionText, { color: colors.text + '40' }]}>Version 1.0.0 (Build 100)</Text>
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
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 13,
    }
});
