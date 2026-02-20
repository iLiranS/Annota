import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Listen to web browser redirects
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const setGuest = useAuthStore((state) => state.setGuest);
    const theme = useAppTheme();

    // Use expo-auth-session to create a redirect URI back to the app
    const redirectUrl = makeRedirectUri();

    async function signInWithOAuth(provider: 'google' | 'apple' | 'github') {
        setLoadingProvider(provider);
        try {
            console.log("My Redirect URI is:", redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true // IMPORTANT: We handle the browser ourselves
                }
            });

            if (error) {
                Alert.alert('Error', error.message);
                setLoadingProvider(null);
                return;
            }

            if (data.url) {
                // Open the browser for OAuth flow
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (result.type === 'success') {
                    const { url } = result;
                    // console.log("Returned URL from browser:", url);

                    // Parse the URL to get the access token
                    const { params, errorCode } = QueryParams.getQueryParams(url);
                    // console.log("Parsed Params:", params);
                    if (errorCode) throw new Error(errorCode);

                    const { access_token, refresh_token, code } = params;

                    if (code) {
                        // PKCE Flow (Default for Supabase v2)
                        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                        if (error) {
                            console.error("Exchange Code Error:", error.message);
                            Alert.alert("Session Error", error.message);
                        } else {
                            console.log("Successfully logged in as:", data.user?.email);
                            const key = await getMasterKey();
                            if (!key) {
                                router.replace('/(auth)/master-key');
                            } else {
                                router.replace('/(drawer)');
                            }
                        }
                    } else if (access_token && refresh_token) {
                        // Implicit Flow
                        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) {
                            console.error("Session Set Error:", error.message);
                            Alert.alert("Session Error", error.message);
                        } else {
                            console.log("Successfully logged in as:", data.user?.email);
                            const key = await getMasterKey();
                            if (!key) {
                                router.replace('/(auth)/master-key');
                            } else {
                                router.replace('/(drawer)');
                            }
                        }
                    } else {
                        console.error("Missing tokens. Received:", params);
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
        router.replace('/(drawer)');
    };

    const renderProviderButton = (provider: 'google' | 'apple' | 'github', icon: keyof typeof Ionicons.glyphMap, label: string) => {
        const isLoading = loadingProvider === provider;
        const isDisabled = loadingProvider !== null || provider === 'apple' || provider === 'google'; // Disable apple and google for now

        return (
            <TouchableOpacity
                style={[
                    styles.providerButton,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    isDisabled && (provider === 'apple' || provider === 'google') ? { opacity: 0.5 } : {}
                ]}
                disabled={isDisabled}
                onPress={() => signInWithOAuth(provider)}
            >
                {isLoading ? (
                    <ActivityIndicator color={theme.colors.text} />
                ) : (
                    <>
                        <Ionicons name={icon} size={24} color={theme.colors.text} style={styles.providerIcon} />
                        <Text style={[styles.providerText, { color: theme.colors.text }]}>Continue with {label}</Text>
                    </>
                )}
            </TouchableOpacity>
        )
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Welcome to Annota</Text>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>
                Sign in to sync your notes securely across all your devices using end-to-end encryption.
            </Text>

            <View style={styles.providersContainer}>
                {renderProviderButton('apple', 'logo-apple', 'Apple')}
                {renderProviderButton('google', 'logo-google', 'Google')}
                {renderProviderButton('github', 'logo-github', 'GitHub')}
            </View>

            <View style={styles.divider}>
                <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
                <Text style={{ color: theme.colors.text, marginHorizontal: 10 }}>OR</Text>
                <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
            </View>

            <TouchableOpacity
                style={[styles.guestButton, { borderColor: theme.colors.border }]}
                onPress={continueAsGuest}
            >
                <Text style={[styles.guestButtonText, { color: theme.colors.text }]}>Continue Offline (Guest)</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 30,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    providersContainer: {
        gap: 15,
        marginBottom: 20,
    },
    providerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    providerIcon: {
        position: 'absolute',
        left: 20,
    },
    providerText: {
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 30,
    },
    line: {
        flex: 1,
        height: 1,
    },
    guestButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    guestButtonText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
});
