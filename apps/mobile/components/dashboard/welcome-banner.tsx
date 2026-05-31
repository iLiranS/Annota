import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';

interface WelcomeBannerProps {
    greeting: string;
    name: string;
    onNewNote: () => void;
    onDailyNote: () => void;
}

export function WelcomeBanner({ greeting, name, onNewNote, onDailyNote }: WelcomeBannerProps) {
    const { colors } = useAppTheme();

    return (
        <View
            style={[
                styles.welcomeCard,
                {
                    backgroundColor: colors.primary + '12',
                    borderColor: colors.primary + '30',
                }
            ]}
        >
            <View style={styles.welcomeTextSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                    <Text style={[styles.welcomeGreeting, { color: colors.text }]}>
                        {greeting}, {name}
                    </Text>
                </View>
                <Text style={[styles.welcomeSubtext, { color: colors.text + '90' }]}>
                    Keep track of your learnings, capture fleeting inspirations, and build your digital knowledge base with ease.
                </Text>
            </View>

            <View style={styles.welcomeActionsRow}>
                <HapticPressable
                    onPress={onNewNote}
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>New Note</Text>
                </HapticPressable>

                <HapticPressable
                    onPress={onDailyNote}
                    style={[
                        styles.actionBtnOutline,
                        {
                            borderColor: colors.primary + '40',
                        }
                    ]}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>Daily Note</Text>
                </HapticPressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    welcomeCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 20,
    },
    welcomeTextSection: {
        marginBottom: 16,
    },
    welcomeGreeting: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    welcomeSubtext: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
        marginTop: 4,
    },
    welcomeActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 1,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    actionBtnOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    actionBtnOutlineText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
