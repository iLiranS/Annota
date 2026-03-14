import SettingItem from '@/components/settings/setting-item';
import UpdateDisplayNameForm from '@/components/user/updateDisplayNameForm';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useUserStore as useAuthStore } from '@annota/core';
import { getMasterKey } from '@annota/core/platform';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GUEST_DISPLAY_NAME_KEY = 'guest_display_name';

export default function AccountSettingsScreen() {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { session, signOut, user, setGuest } = useAuthStore();
    const [isDisplayNameModalVisible, setIsDisplayNameModalVisible] = React.useState(false);
    const [guestDisplayName, setGuestDisplayName] = React.useState('');

    const [userRole, setUserRole] = React.useState<string | null>(null);
    const [storeDisplayName, setStoreDisplayName] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (session) {
            const fetchData = async () => {
                const [role, name] = await Promise.all([
                    useAuthStore.getState().getUserRole(),
                    useAuthStore.getState().getDisplayName()
                ]);
                setUserRole(role);
                setStoreDisplayName(name);
            };
            fetchData();
        } else {
            setUserRole(null);
            setStoreDisplayName(null);
        }
    }, [session]);

    const globalDisplayName = useAuthStore(state => state.displayName);
    const displayNameFetched = useAuthStore(state => state.displayNameFetched);
    React.useEffect(() => {
        if (globalDisplayName !== undefined && globalDisplayName !== null) {
            setStoreDisplayName(globalDisplayName);
        }
    }, [globalDisplayName]);

    React.useEffect(() => {
        if (session) return;

        let cancelled = false;

        const loadGuestDisplayName = async () => {
            try {
                const value = await AsyncStorage.getItem(GUEST_DISPLAY_NAME_KEY);
                if (!cancelled) {
                    setGuestDisplayName(value?.trim() || '');
                }
            } catch (error) {
                console.error('Error loading guest display name:', error);
            }
        };

        loadGuestDisplayName();

        return () => {
            cancelled = true;
        };
    }, [session]);

    const fallbackName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.user_metadata?.preferred_username || 'Guest';
    const displayName = session ? (storeDisplayName || (displayNameFetched ? fallbackName : '...')) : (guestDisplayName || 'Not set');

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

    const handleSignIn = () => {
        setGuest(false);
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

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Delete Account',
            'This action is irreversible. Your account and all synced data in the cloud will be permanently deleted. Your local data will remain on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: async () => {
                        const hasHardware = await LocalAuthentication.hasHardwareAsync();
                        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

                        if (hasHardware && isEnrolled) {
                            const authResult = await LocalAuthentication.authenticateAsync({
                                promptMessage: 'Authenticate to delete your account',
                                cancelLabel: 'Cancel',
                            });

                            if (!authResult.success) return;
                        }

                        try {
                            await useAuthStore.getState().deleteAccount();
                        } catch (error) {
                            console.error('Failed to delete account:', error);
                            Alert.alert('Error', 'Failed to delete account. Please try again.');
                        }
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
                <Text style={[styles.sectionHeader, { color: colors.text + '80' }]}>{session ? 'PROFILE' : 'ACCOUNT'}</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    {session ? (
                        <>
                            <SettingItem
                                label="Connected Email"
                                icon="mail-outline"
                                type="value"
                                onPress={() => { }}
                                description={session.user?.email || 'Authenticated User'}
                                iconColor="#FFFFFF"
                                iconBackgroundColor="#34C759"
                            />
                            <SettingItem
                                label="Display Name"
                                icon="person-outline"
                                onPress={() => setIsDisplayNameModalVisible(true)}
                                description={displayName}
                                iconColor="#FFFFFF"
                                iconBackgroundColor={colors.primary}
                            />
                            <SettingItem
                                label="Account Role"
                                icon={
                                    userRole?.toLowerCase() === 'pro' ? 'star' :
                                        userRole?.toLowerCase() === 'beta' ? 'flask' :
                                            userRole?.toLowerCase() === 'admin' ? 'hammer' :
                                                'shield-checkmark-outline'
                                }
                                type="value"
                                onPress={() => { }}
                                value={<RoleBadge role={userRole || ''} colors={colors} />}
                                iconColor="#FFFFFF"
                                iconBackgroundColor={
                                    userRole?.toLowerCase() === 'pro' ? '#DAA520' :
                                        userRole?.toLowerCase() === 'beta' ? '#5856D6' :
                                            userRole?.toLowerCase() === 'admin' ? '#FF3B30' :
                                                '#FF9500'
                                }
                            />
                            <SettingItem
                                label="Sign Out"
                                icon="log-out-outline"
                                onPress={handleSignOut}
                                iconColor="#FFFFFF"
                                iconBackgroundColor="#FF3B30"
                            />
                        </>
                    ) : (
                        <>
                            <SettingItem
                                label="Sign In"
                                icon="log-in-outline"
                                onPress={handleSignIn}
                                description="Enable cloud sync"
                                iconColor="#FFFFFF"
                                iconBackgroundColor="#007AFF"
                            />
                            <SettingItem
                                label="Update Display Name"
                                icon="person-outline"
                                onPress={() => setIsDisplayNameModalVisible(true)}
                                description={displayName}
                                iconColor="#FFFFFF"
                                iconBackgroundColor={colors.primary}
                            />
                        </>
                    )}
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
                        <SettingItem
                            label="Delete Account"
                            icon="trash-outline"
                            onPress={handleDeleteAccount}
                            description="Permanently delete account and cloud data"
                            iconColor="#FFFFFF"
                            iconBackgroundColor="#FF3B30"
                        />
                    </View>
                </View>
            )}



            <UpdateDisplayNameForm
                visible={isDisplayNameModalVisible}
                onClose={() => setIsDisplayNameModalVisible(false)}
                initialValue={session ? (user?.user_metadata?.display_name || '') : guestDisplayName}
                onSaved={setGuestDisplayName}
            />
        </ScrollView>
    );
}

function RoleBadge({ role, colors }: { role: string; colors: any }) {
    if (!role) return <Text style={{ color: colors.text + '60', fontSize: 15 }}>Loading...</Text>;

    const lowerRole = role.toLowerCase();
    const isPro = lowerRole === 'pro';
    const isBeta = lowerRole === 'beta';
    const isAdmin = lowerRole === 'admin';

    if (isPro) {
        return (
            <View style={[styles.badge, { backgroundColor: '#DAA52020', borderColor: '#DAA52040' }]}>
                <Ionicons name="sparkles" size={12} color="#DAA520" style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: '#DAA520', fontWeight: '700' }]}>PRO</Text>
            </View>
        );
    }

    if (isBeta) {
        return (
            <View style={[styles.badge, { backgroundColor: '#5856D620', borderColor: '#5856D640' }]}>
                <Ionicons name="flask" size={12} color="#5856D6" style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: '#5856D6', fontWeight: '700' }]}>BETA</Text>
            </View>
        );
    }

    if (isAdmin) {
        return (
            <View style={[styles.badge, { backgroundColor: '#FF3B3020', borderColor: '#FF3B3040' }]}>
                <Ionicons name="hammer" size={12} color="#FF3B30" style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: '#FF3B30', fontWeight: '700' }]}>ADMIN</Text>
            </View>
        );
    }

    return (
        <Text style={{ color: colors.text + '60', fontSize: 15 }}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
        </Text>
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
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 11,
        letterSpacing: 0.5,
    },
});
