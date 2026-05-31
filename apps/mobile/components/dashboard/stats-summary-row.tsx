import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '@/hooks/use-app-theme';

interface StatsSummaryRowProps {
    notesCount: number;
    foldersCount: number;
    tagsCount: number;
}

export function StatsSummaryRow({ notesCount, foldersCount, tagsCount }: StatsSummaryRowProps) {
    const { colors } = useAppTheme();

    return (
        <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#6366F115' }]}>
                    <Ionicons name="book-outline" size={18} color="#6366F1" />
                </View>
                <View style={styles.statInfo}>
                    <Text style={[styles.statLabel, { color: colors.text + '50' }]}>NOTES</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{notesCount}</Text>
                </View>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIconWrapper, { backgroundColor: '#10B98115' }]}>
                    <Ionicons name="folder-open-outline" size={18} color="#10B981" />
                </View>
                <View style={styles.statInfo}>
                    <Text style={[styles.statLabel, { color: colors.text + '50' }]}>FOLDERS</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{foldersCount}</Text>
                </View>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
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
