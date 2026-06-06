import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable } from '../ui/haptic-pressable';

interface StatsSummaryRowProps {
    notesCount: number;
    foldersCount: number;
    tagsCount: number;
    publishedCount?: number;
    isPremium?: boolean;
    onPressPublished?: () => void;
}

export function StatsSummaryRow({ 
    notesCount, 
    foldersCount, 
    tagsCount,
    publishedCount = 0,
    isPremium = false,
    onPressPublished
}: StatsSummaryRowProps) {
    const { colors } = useAppTheme();

    if (isPremium) {
        return (
            <View style={styles.statsGrid}>
                <View style={styles.gridRow}>
                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#6366F115' }]}>
                            <Ionicons name="book-outline" size={18} color="#6366F1" />
                        </View>
                        <View style={styles.statInfo}>
                            <Text style={[styles.statLabel, { color: colors.text + '50' }]}>NOTES</Text>
                            <Text style={[styles.statValue, { color: colors.text }]}>{notesCount}</Text>
                        </View>
                    </View>

                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#10B98115' }]}>
                            <Ionicons name="folder-open-outline" size={18} color="#10B981" />
                        </View>
                        <View style={styles.statInfo}>
                            <Text style={[styles.statLabel, { color: colors.text + '50' }]}>FOLDERS</Text>
                            <Text style={[styles.statValue, { color: colors.text }]}>{foldersCount}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.gridRow}>
                    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
                        <View style={[styles.statIconWrapper, { backgroundColor: '#EC489915' }]}>
                            <Ionicons name="pricetag-outline" size={18} color="#EC4899" />
                        </View>
                        <View style={styles.statInfo}>
                            <Text style={[styles.statLabel, { color: colors.text + '50' }]}>TAGS</Text>
                            <Text style={[styles.statValue, { color: colors.text }]}>{tagsCount}</Text>
                        </View>
                    </View>

                    <HapticPressable 
                        onPress={onPressPublished}
                        style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}
                    >
                        <View style={[styles.statIconWrapper, { backgroundColor: '#3B82F615' }]}>
                            <Ionicons name="globe-outline" size={18} color="#3B82F6" />
                        </View>
                        <View style={styles.statInfo}>
                            <Text style={[styles.statLabel, { color: colors.text + '50' }]}>PUBLISHED</Text>
                            <Text style={[styles.statValue, { color: colors.text }]}>{publishedCount}</Text>
                        </View>
                    </HapticPressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#6366F115' }]}>
                    <Ionicons name="book-outline" size={18} color="#6366F1" />
                </View>
                <View style={styles.statInfo}>
                    <Text style={[styles.statLabel, { color: colors.text + '50' }]}>NOTES</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{notesCount}</Text>
                </View>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#10B98115' }]}>
                    <Ionicons name="folder-open-outline" size={18} color="#10B981" />
                </View>
                <View style={styles.statInfo}>
                    <Text style={[styles.statLabel, { color: colors.text + '50' }]}>FOLDERS</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{foldersCount}</Text>
                </View>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border + "60" }]}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#EC489915' }]}>
                    <Ionicons name="pricetag-outline" size={18} color="#EC4899" />
                </View>
                <View style={styles.statInfo}>
                    <Text style={[styles.statLabel, { color: colors.text + '50' }]}>TAGS</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{tagsCount}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
    },
    statsGrid: {
        flexDirection: 'column',
        gap: 8,
        marginBottom: 24,
    },
    gridRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        flexBasis: 0,
    },
    statIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statInfo: {
        flex: 1,
    },
    statLabel: {
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
    },
});

