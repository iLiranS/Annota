import NoteLocationModal from '@/components/note-location-modal';
import NoteCard from '@/components/notes/note-card';
import ThemedText from '@/components/themed-text';
import { useNotesStore, type NoteMetadata } from '@/lib/stores/notes.store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface RecentNotesListProps {
    onNotePress?: (noteId: string) => void;
    onCreateNote: () => void;
}

export default function RecentNotesList({ onCreateNote }: RecentNotesListProps) {
    const router = useRouter();
    const { colors, dark } = useTheme();
    const { notes, deleteNote, updateNoteMetadata } = useNotesStore();
    const [editingNote, setEditingNote] = useState<NoteMetadata | null>(null);

    const recentNotes = useMemo(() => {
        const activeNotes = notes.filter(n => !n.isDeleted);
        return activeNotes
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);
    }, [notes]);

    const handleNotePress = useCallback((noteId: string) => {
        router.push({ pathname: `/Notes/[id]`, params: { id: noteId, source: 'home' } });
    }, [router]);

    const handleNoteLongPress = useCallback((note: NoteMetadata) => {
        setEditingNote(note);
    }, []);

    const handleDeleteNote = useCallback(async (noteId: string) => {
        await deleteNote(noteId);
    }, [deleteNote]);

    const handleTogglePin = useCallback(async (note: NoteMetadata) => {
        await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
    }, [updateNoteMetadata]);

    const handleToggleQuickAccess = useCallback(async (note: NoteMetadata) => {
        await updateNoteMetadata(note.id, { isQuickAccess: !note.isQuickAccess });
    }, [updateNoteMetadata]);

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
                        {recentNotes.map((note, index) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onPress={() => handleNotePress(note.id)}
                                onLongPress={() => handleNoteLongPress(note)}
                                onDelete={() => handleDeleteNote(note.id)}
                                onTogglePin={() => handleTogglePin(note)}
                                onToggleQuickAccess={() => handleToggleQuickAccess(note)}
                                isFirst={index === 0}
                                isLast={index === recentNotes.length - 1}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={[styles.emptyState, { borderColor: colors.border }]}>
                        <Ionicons name="document-text-outline" size={32} color={colors.text + '15'} />
                        <ThemedText style={[styles.emptyText, { color: colors.text + '40' }]}>
                            No recent notes
                        </ThemedText>
                    </View>
                )}
            </ScrollView>

            <NoteLocationModal
                visible={editingNote !== null}
                note={editingNote}
                onClose={() => setEditingNote(null)}
            />
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
        paddingHorizontal: 20,
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
        gap: 0,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        borderRadius: 20,
        borderWidth: 1,
        marginHorizontal: 20,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
});

