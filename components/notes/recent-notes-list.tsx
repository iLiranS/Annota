import NoteListItem from '@/components/notes/note-list-item';
import ThemedText from '@/components/themed-text';
import { useNotesStore } from '@/stores/notes-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface RecentNotesListProps {
    onNotePress?: (noteId: string) => void;
    onCreateNote: () => void;
}

export default function RecentNotesList({ onCreateNote }: RecentNotesListProps) {
    const router = useRouter();
    const { colors, dark } = useTheme();
    const notes = useNotesStore((state) => state.notes);

    const recentNotes = useMemo(() => {
        const activeNotes = notes.filter(n => !n.isDeleted);
        return activeNotes
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);
    }, [notes]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <ThemedText style={[styles.title, { color: colors.text + '80' }]}>
                    Recent Notes
                </ThemedText>

                <View style={styles.headerRight}>
                    <Pressable
                        onPress={onCreateNote}
                        style={({ pressed }) => [
                            styles.addButton,
                            {
                                backgroundColor: colors.primary + '90',
                                opacity: pressed ? 0.8 : 1
                            }
                        ]}
                        hitSlop={8}
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>
            </View>

            {/* Notes List with ScrollView */}
            <ScrollView
                style={styles.listContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {recentNotes.length > 0 ? (
                    <View style={styles.notesList}>
                        {recentNotes.map((note) => (
                            <NoteListItem
                                key={note.id}
                                note={note}
                                onPress={() => router.push({ pathname: `/Notes/[id]`, params: { id: note.id, source: 'home' } })}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={[styles.emptyState, { backgroundColor: dark ? 'rgba(255,255,255,0.02)' : colors.card, borderColor: colors.border }]}>
                        <Ionicons name="document-text-outline" size={32} color={colors.text + '15'} />
                        <ThemedText style={[styles.emptyText, { color: colors.text + '40' }]}>
                            No recent notes
                        </ThemedText>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        minHeight: 32,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    listContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    notesList: {
        gap: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        borderRadius: 20,
        borderWidth: 1,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
});
