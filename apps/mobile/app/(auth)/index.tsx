import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { authApi, useUserStore as useAuthStore, isCloudEnabled } from '@annota/core';
import { getMasterKey } from '@annota/core/platform';
import { Ionicons } from '@expo/vector-icons';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeInDown,
    FadeInUp
} from 'react-native-reanimated';

// Listen to web browser redirects
WebBrowser.maybeCompleteAuthSession();

async function generateNonceAndHash() {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const nonce = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
    );
    return { nonce, digest };
}

export default function LoginScreen() {
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const setGuest = useAuthStore((state) => state.setGuest);
    const theme = useAppTheme();

    // Use expo-linking to create a redirect URI back to the app
    const redirectUrl = Linking.createURL('login-callback');

    async function signInWithAppleNative() {
        const routeAfterSignIn = async () => {
            const { data: { session } } = await authApi.getSession();
            const userId = session?.user?.id;
            if (!userId) {
                Alert.alert("Session Error", "No user session was found after login.");
                return;
            }

            const key = await getMasterKey(userId);
            if (!key) {
                router.replace('/(auth)/master-key');
            } else {
                router.replace('/(app)');
            }
        };

        setLoadingProvider('apple');
        try {
            const { nonce, digest } = await generateNonceAndHash();

            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce: digest,
            });

            if (credential.identityToken) {
                const { error } = await authApi.signInWithIdToken(
                    credential.identityToken,
                    nonce
                );

                if (error) {
                    Alert.alert('Supabase Auth Error', error.message);
                    setLoadingProvider(null);
                    return;
                }

                await routeAfterSignIn();
            } else {
                throw new Error("No identity token returned from Apple");
            }
        } catch (err: any) {
            if (err.code !== 'ERR_REQUEST_CANCELED') {
                console.error("Native Apple Sign-in failed, falling back to web flow:", err);
                await signInWithOAuth('apple');
            }
        } finally {
            setLoadingProvider(null);
        }
    }

    async function signInWithOAuth(provider: 'google' | 'apple' | 'github') {
        const routeAfterSignIn = async () => {
            const { data: { session } } = await authApi.getSession();
            const userId = session?.user?.id;
            if (!userId) {
                Alert.alert("Session Error", "No user session was found after login.");
                return;
            }

            const key = await getMasterKey(userId);
            if (!key) {
                router.replace('/(auth)/master-key');
            } else {
                router.replace('/(app)');
            }
        };

        setLoadingProvider(provider);
        try {
            const { data, error } = await authApi.signInWithOAuth(provider, redirectUrl, {
                queryParams: {
                    prompt: 'consent',
                },
            });

            if (error) {
                Alert.alert('Error', error.message);
                setLoadingProvider(null);
                return;
            }

            if (data.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (result.type === 'success') {
                    const { url } = result;
                    const { params, errorCode } = QueryParams.getQueryParams(url);
                    if (errorCode) throw new Error(errorCode);

                    // Surfacing explicit Supabase OAuth errors
                    if (params.error || params.error_description) {
                        const errorMsg = (params.error_description || params.error || '').replace(/\+/g, ' ');
                        Alert.alert("Authentication Error", errorMsg);
                        setLoadingProvider(null);
                        return;
                    }

                    const { access_token, refresh_token, code } = params;

                    if (code) {
                        const { data, error } = await authApi.exchangeCodeForSession(code);
                        if (error) {
                            Alert.alert("Session Error", error.message);
                        } else {
                            await routeAfterSignIn();
                        }
                    } else if (access_token && refresh_token) {
                        const { data, error } = await authApi.setSession(access_token, refresh_token);
                        if (error) {
                            Alert.alert("Session Error", error.message);
                        } else {
                            await routeAfterSignIn();
                        }
                    } else {
                        Alert.alert("Login Failed", "No access token or code was returned from the authentication provider.");
                    }
                }
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoadingProvider(null);
        }
    }

    const continueAsGuest = () => {
        setGuest(true);
        router.replace('/(app)');
    };

    useEffect(() => {
        if (!isCloudEnabled) {
            continueAsGuest();
        }
    }, []);

    const renderProviderButton = (provider: 'google' | 'apple' | 'github', icon: keyof typeof Ionicons.glyphMap, label: string, index: number) => {
        const isLoading = loadingProvider === provider;
        const isDisabled = loadingProvider !== null;

        return (
            <Animated.View entering={FadeInDown.delay(400 + index * 100).duration(600)}>
                <HapticPressable
                    style={({ pressed }) => [
                        styles.providerButton,
                        {
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                            opacity: pressed ? 0.8 : (isDisabled ? 0.5 : 1)
                        }
                    ]}
                    disabled={isDisabled}
                    onPress={async () => {
                        if (provider === 'apple' && await AppleAuthentication.isAvailableAsync()) {
                            signInWithAppleNative();
                        } else {
                            signInWithOAuth(provider);
                        }
                    }}
                >
                    {isLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                    ) : (
                        <>
                            <Ionicons name={icon} size={22} color={theme.colors.text} style={styles.providerIcon} />
                            <Text style={[styles.providerText, { color: theme.colors.text }]}>Continue with {label}</Text>
                        </>
                    )}
                </HapticPressable>
            </Animated.View>
        )
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Stack.Screen options={{ orientation: 'portrait' }} />

            <View style={styles.content}>
                <Animated.View entering={FadeInUp.duration(800).springify()} style={styles.header}>
                    <Image
                        source={require('@/assets/images/icon.png')}
                        style={styles.logo}
                    />
                    <Text style={[styles.title, { color: theme.colors.text }]}>Annota</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.text + '99' }]}>
                        Sign in to sync your data with end-to-end encryption.
                    </Text>
                </Animated.View>

                <View style={styles.providersContainer}>

                    {renderProviderButton('apple', 'logo-apple', 'Apple', 1)}
                    {renderProviderButton('google', 'logo-google', 'Google', 2)}
                    {renderProviderButton('github', 'logo-github', 'GitHub', 3)}
                </View>

                <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.dividerContainer}>
                    <View style={styles.divider}>
                        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
                        <Text style={[styles.dividerText, { color: theme.colors.text + '60' }]}>OR</Text>
                        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(800).duration(600)}>
                    <HapticPressable
                        style={({ pressed }) => [
                            styles.guestButton,
                            {
                                borderColor: theme.colors.border,
                                backgroundColor: pressed ? theme.colors.card + '80' : 'transparent',
                                opacity: pressed ? 0.9 : 1
                            }
                        ]}
                        onPress={continueAsGuest}
                    >
                        <Text style={[styles.guestButtonText, { color: theme.colors.text }]}>Continue Offline (Guest)</Text>
                    </HapticPressable>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(900).duration(600)} style={styles.footer}>
                    <Text style={[styles.termsText, { color: theme.colors.text + '60' }]}>
                        By using Annota, you agree to our{' '}
                        <Text
                            style={styles.link}
                            onPress={() => WebBrowser.openBrowserAsync('https://annota.online/tos')}
                        >
                            Terms of Service
                        </Text>
                        {' '}and{' '}
                        <Text
                            style={styles.link}
                            onPress={() => WebBrowser.openBrowserAsync('https://annota.online/privacy')}
                        >
                            Privacy Policy
                        </Text>.
                    </Text>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,

        alignSelf: 'center',
    },
    content: {
        flex: 1,
        padding: 32,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logo: {
        width: 80,
        height: 80,
        borderRadius: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        marginBottom: 12,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 17,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 280,
    },
    providersContainer: {
        gap: 14,
        marginBottom: 24,
    },
    providerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1.5,
    },

    providerIcon: {
        marginRight: 10,
    },
    providerText: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    dividerContainer: {
        marginVertical: 24,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dividerText: {
        fontSize: 13,
        fontWeight: '700',
        marginHorizontal: 16,
        letterSpacing: 1,
    },
    line: {
        flex: 1,
        height: 1,
    },
    guestButton: {
        padding: 16,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1.5,
    },
    guestButtonText: {
        fontWeight: '700',
        fontSize: 16,
    },
    footer: {
        marginTop: 32,
        alignItems: 'center',
    },
    termsText: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 20,
    },
    link: {
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
});
