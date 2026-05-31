import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DAILY_NOTES_FOLDER_ID, useNotesStore, type NoteMetadata } from '@annota/core';
import NoteCard from '@/components/notes/note-card';
import { useAppTheme } from '@/hooks/use-app-theme';

interface RecentNotesSectionProps {
    recentNotes: NoteMetadata[];
    onNotePress: (noteId: string) => void;
}

export function RecentNotesSection({ recentNotes, onNotePress }: RecentNotesSectionProps) {
    const { colors } = useAppTheme();
    const { getFolderById } = useNotesStore();

    // Custom FolderBadge suffix component inside note item cards
    const FolderBadge = ({ folderId }: { folderId: string | null }) => {
        let folder = folderId ? getFolderById(folderId) : null;
        if (folderId === DAILY_NOTES_FOLDER_ID) {
            folder = {
                id: DAILY_NOTES_FOLDER_ID,
                name: "Daily Notes",
                icon: "calendar",
                color: "#8B5CF6",
            } as any;
        }
        if (!folder) return null;

        return (
            <View
                style={[
                    styles.folderBadge,
                    {
                        backgroundColor: folder.color ? `${folder.color}15` : `${colors.primary}12`,
                        borderColor: folder.color ? `${folder.color}35` : `${colors.primary}30`,
                    }
                ]}
            >
                <Ionicons
                    name={folder.icon ? (folder.icon as any) : "folder"}
                    size={9}
                    color={folder.color || colors.primary}
                />
                <Text
                    style={[
                        styles.folderBadgeText,
                        { color: folder.color || colors.primary }
                    ]}
                    numberOfLines={1}
                >
                    {folder.name}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderContainer}>
                <Ionicons name="time-outline" size={16} color={colors.text + '80'} />
                <Text style={[styles.sectionTitle, { color: colors.text + '99' }]}>RECENTLY UPDATED NOTES</Text>
            </View>

            {recentNotes.length === 0 ? (
                <View style={[styles.emptyContainer, { borderColor: colors.border }]}>
                    <Ionicons name="document-text-outline" size={32} color={colors.text + '20'} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes found</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.text + '50' }]}>Click "New Note" above to get started!</Text>
                </View>
            ) : (
                <View style={[styles.notesListWrapper, { backgroundColor: colors.card + '25', borderColor: colors.border }]}>
                    {recentNotes.map((note, index) => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onPress={() => onNotePress(note.id)}
                            suffix={<FolderBadge folderId={note.folderId} />}
                            isFirst={index === 0}
                            isLast={index === recentNotes.length - 1}
                            swipeable={false}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        marginBottom: 24,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingLeft: 4,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    notesListWrapper: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    folderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
        alignSelf: 'center',
    },
    folderBadgeText: {
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyContainer: {
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    emptySubtitle: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
});
