import SettingItem from '@/components/settings/setting-item';
import { useAppTheme } from '@/hooks/use-app-theme';
import { getMasterKey } from '@/lib/utils/crypto';
import { useAuthStore } from '@/stores/auth-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AccountSettingsScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { session, signOut } = useAuthStore();

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out? Your local data will remain, but syncing will stop.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                    }
                }
            ]
        );
    };

    const handleRevealKey = async () => {
        const userId = session?.user?.id;
        if (!userId) {
            Alert.alert('Error', 'No active session found.');
            return;
        }

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
            Alert.alert(
                'Authentication Unavailable',
                'Your device does not support biometric authentication. Please set up Face ID, Touch ID, or a passcode first.'
            );
            return;
        }

        const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to reveal your master key',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
        });

        if (!authResult.success) return;

        const key = await getMasterKey(userId);
        if (!key) {
            Alert.alert('No Key Found', 'No master key is stored on this device.');
            return;
        }

        Alert.alert(
            'Your Master Key',
            key,
            [{ text: 'Done', style: 'default' }]
        );
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
            <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>PROFILE</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <SettingItem
                        label="Connected Email"
                        icon="mail-outline"
                        onPress={() => { }}
                        description={session?.user?.email || 'Authenticated User'}
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#34C759"
                    />
                    <SettingItem
                        label="Sign Out"
                        icon="log-out-outline"
                        onPress={handleSignOut}
                        iconColor="#FFFFFF"
                        iconBackgroundColor="#FF3B30"
                    />
                </View>
            </View>

            {session && (
                <View style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>SECURITY</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingItem
                            label="Reveal Master Key"
                            icon="key-outline"
                            onPress={handleRevealKey}
                            description="Authenticate to view your 12-word phrase"
                            iconColor="#FFFFFF"
                            iconBackgroundColor="#5856D6"
                        />
                    </View>
                </View>
            )}
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
