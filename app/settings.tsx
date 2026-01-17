import ThemedText from '@/components/themed-text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function SettingsScreen() {
    const { colors, dark } = useTheme();
    const router = useRouter();


    return (
        <View style={[styles.container]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Settings',
                    headerLeft: () => (
                        <Pressable
                            onPress={() => router.back()}
                            style={styles.backButton}
                            hitSlop={8}
                        >
                            <Ionicons name="chevron-back" size={26} color={colors.primary} />
                        </Pressable>
                    ),
                }}
            />

            <View style={styles.content}>
                <View
                    style={[
                        styles.placeholderCard,
                        {
                            backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                        },
                    ]}
                >
                    <Ionicons name="construct-outline" size={48} color={colors.text + '40'} />
                    <ThemedText style={[styles.placeholderTitle, { color: colors.text }]}>
                        Settings Coming Soon
                    </ThemedText>
                    <ThemedText style={[styles.placeholderSubtitle, { color: colors.text + '60' }]}>
                        Preferences, themes, and account settings will appear here.
                    </ThemedText>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    placeholderCard: {
        alignItems: 'center',
        padding: 40,
        borderRadius: 20,
        borderWidth: 1,
        gap: 16,
        maxWidth: 320,
    },
    placeholderTitle: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    placeholderSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
