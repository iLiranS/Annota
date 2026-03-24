import SettingItem from '@/components/settings/setting-item';
import { useAppTheme } from '@/hooks/use-app-theme';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HelpSettings() {
    const { colors } = useAppTheme();

    const handleMailSupport = () => {
        Linking.openURL("mailto:support@annota.online");
    };

    const handleDiscordOpen = () => {
        Linking.openURL("https://discord.gg/dG5nNJPDAh");
    };

    const handleWebsiteOpen = () => {
        Linking.openURL("https://annota.online");
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>CONTACT & SUPPORT</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Email Support"
                        description="Send us an email for any issues"
                        icon="mail-outline"
                        onPress={handleMailSupport}
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#007AFF"
                    />
                    <SettingItem
                        label="Join Discord"
                        description="Chat with the community"
                        icon="chatbubbles-outline"
                        onPress={handleDiscordOpen}
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#5865F2"
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>RESOURCES</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Official Website"
                        description="Learn more about Annota"
                        icon="globe-outline"
                        onPress={handleWebsiteOpen}
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#34C759"
                    />
                </View>
            </View>

            <View style={styles.infoSection}>
                <Text style={[styles.infoText, { color: colors.text + '60' }]}>
                    Have feedback or any issue to report? You can use the methods above to reach us. We'd love to hear from you!
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
    infoSection: {
        marginTop: 32,
        paddingHorizontal: 28,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    }
});
