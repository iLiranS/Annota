import NoteListItem from '@/components/notes/note-list-item';
import ThemedText from '@/components/themed-text';
import { useNotesStore } from '@/stores/notes-store';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function RecentNotes() {
    const router = useRouter();
    const { colors } = useTheme();
    const notes = useNotesStore((state) => state.notes);

    const recentNotes = useMemo(() => {
        const activeNotes = notes.filter(n => !n.isDeleted);
        return activeNotes
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);
    }, [notes]);

    return (
        <View>
            <View style={styles.sectionHeaderWithAction}>
                <ThemedText style={styles.sectionTitle}>Notes</ThemedText>
                <Pressable onPress={() => router.push('/Notes')}>
                    <ThemedText style={[styles.viewAllText, { color: colors.primary }]}>View All</ThemedText>
                </Pressable>
            </View>

            {recentNotes.length > 0 ? (
                <View style={{ gap: 10 }}>
                    {recentNotes.map((note) => (
                        <NoteListItem
                            key={note.id}
                            note={note}
                            onPress={() => router.push(`/Notes/${note.id}`)}
                        />
                    ))}
                </View>
            ) : (
                <View style={styles.emptyContent}>
                    <ThemedText style={{ color: colors.text + '50' }}>No recent notes</ThemedText>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionHeaderWithAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    emptyContent: {
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
    },
});
