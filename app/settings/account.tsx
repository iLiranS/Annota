import SettingItem from '@/components/settings/setting-item';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AccountSettingsScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { session, signOut, setGuest } = useAuthStore();

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
                        setGuest(false);
                        router.dismissAll();
                        router.replace('/(auth)');
                    }
                }
            ]
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
