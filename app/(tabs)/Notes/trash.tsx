import SwipeableItem from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import {
    Folder,
    Note,
    sortFolders,
    sortNotes,
    TRASH_FOLDER_ID,
} from '@/dev-data/data';
import { useNotesStore } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

interface FolderItemProps {
    folder: Folder;
    onPress: () => void;
    onRestore: () => void;
    onPermanentDelete: () => void;
}

function FolderCard({ folder, onPress, onRestore, onPermanentDelete }: FolderItemProps) {
    const { colors, dark } = useTheme();

    const formatDate = (date: Date | null): string => {
        if (!date) return 'Unknown';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <SwipeableItem onRestore={onRestore} isInTrash>
            <ThemedPressable
                onPress={onPress}
                onLongPress={onPermanentDelete}
                style={({ pressed }) => [
                    styles.folderCard,
                    {
                        borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                    pressed && styles.pressed,
                ]}
            >
                <View style={[styles.folderIcon, { backgroundColor: '#EF4444' + '20' }]}>
                    <Ionicons name="folder" size={22} color="#EF4444" />
                </View>
                <View style={styles.folderContent}>
                    <ThemedText style={styles.folderName}>{folder.name}</ThemedText>
                    <ThemedText style={[styles.deletedDate, { color: colors.text + '60' }]}>
                        Deleted {formatDate(folder.deletedAt)}
                    </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text + '50'} />
            </ThemedPressable>
        </SwipeableItem>
    );
}

interface NoteItemProps {
    note: Note;
    onPress: () => void;
    onRestore: () => void;
    onPermanentDelete: () => void;
}

function NoteCard({ note, onPress, onRestore, onPermanentDelete }: NoteItemProps) {
    const { colors, dark } = useTheme();

    const formatDate = (date: Date | null): string => {
        if (!date) return 'Unknown';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <SwipeableItem onRestore={onRestore} isInTrash>
            <ThemedPressable
                onPress={onPress}
                onLongPress={onPermanentDelete}
                style={({ pressed }) => [
                    styles.noteCard,
                    {
                        borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                    pressed && styles.pressed,
                ]}
            >
                <View style={styles.noteHeader}>
                    <View style={styles.titleRow}>
                        <Ionicons name="document-text" size={16} color="#EF4444" />
                        <ThemedText style={styles.title}>{note.title}</ThemedText>
                    </View>
                </View>
                <ThemedText
                    style={[styles.preview, { color: colors.text + '70' }]}
                    numberOfLines={1}
                >
                    {note.preview}
                </ThemedText>
                <ThemedText style={[styles.deletedDate, { color: colors.text + '60' }]}>
                    Deleted {formatDate(note.deletedAt)}
                </ThemedText>
            </ThemedPressable>
        </SwipeableItem>
    );
}

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: Note }
    | { type: 'section-header'; title: string };

export default function TrashScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(TRASH_FOLDER_ID);

    // Zustand store
    const {
        notes,
        folders,
        restoreNote,
        restoreFolder,
        permanentlyDeleteNote,
        permanentlyDeleteFolder,
        emptyTrash,
        getNotesInFolder,
        getFoldersInFolder,
        getFolderById,
    } = useNotesStore();

    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;

    // Get deleted folders and notes in current folder
    const deletedFolders = useMemo(() => {
        const folderList = getFoldersInFolder(currentFolderId, true);
        return sortFolders(folderList.filter((f) => f.isDeleted), 'UPDATED_LAST');
    }, [folders, currentFolderId]);

    const deletedNotes = useMemo(() => {
        const noteList = getNotesInFolder(currentFolderId, true);
        return sortNotes(noteList.filter((n) => n.isDeleted), 'UPDATED_LAST');
    }, [notes, currentFolderId]);

    const trashData = useMemo((): ListItem[] => {
        const items: ListItem[] = [];
        if (deletedFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            deletedFolders.forEach((f) => items.push({ type: 'folder', data: f }));
        }
        if (deletedNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            deletedNotes.forEach((n) => items.push({ type: 'note', data: n }));
        }
        return items;
    }, [deletedFolders, deletedNotes]);

    const handleFolderPress = useCallback(
        (folderId: string) => {
            setCurrentFolderId(folderId);
        },
        []
    );

    const handleNotePress = useCallback(
        (noteId: string) => {
            router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
        },
        [router]
    );

    const handleBack = useCallback(() => {
        if (currentFolder?.parentId) {
            setCurrentFolderId(currentFolder.parentId);
        } else {
            setCurrentFolderId(TRASH_FOLDER_ID);
        }
    }, [currentFolder]);

    const handleRestoreFolder = useCallback(
        (folderId: string) => {
            restoreFolder(folderId);
        },
        [restoreFolder]
    );

    const handleRestoreNote = useCallback(
        (noteId: string) => {
            restoreNote(noteId);
        },
        [restoreNote]
    );

    const handlePermanentDeleteFolder = useCallback(
        (folderId: string, folderName: string) => {
            Alert.alert(
                'Permanently Delete',
                `Are you sure you want to permanently delete "${folderName}" and all its contents? This action cannot be undone.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => permanentlyDeleteFolder(folderId),
                    },
                ]
            );
        },
        [permanentlyDeleteFolder]
    );

    const handlePermanentDeleteNote = useCallback(
        (noteId: string, noteTitle: string) => {
            Alert.alert(
                'Permanently Delete',
                `Are you sure you want to permanently delete "${noteTitle}"? This action cannot be undone.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => permanentlyDeleteNote(noteId),
                    },
                ]
            );
        },
        [permanentlyDeleteNote]
    );

    const handleEmptyTrash = useCallback(() => {
        Alert.alert(
            'Empty Trash',
            'Are you sure you want to permanently delete all items in trash? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Empty Trash',
                    style: 'destructive',
                    onPress: () => {
                        emptyTrash();
                        setCurrentFolderId(TRASH_FOLDER_ID);
                    },
                },
            ]
        );
    }, [emptyTrash]);

    const headerTitle = currentFolder && currentFolderId !== TRASH_FOLDER_ID ? currentFolder.name : 'Trash';

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === 'section-header') {
            return (
                <ThemedText style={[styles.sectionHeader, { color: colors.text + '60' }]}>
                    {item.title}
                </ThemedText>
            );
        }

        if (item.type === 'folder') {
            return (
                <FolderCard
                    folder={item.data}
                    onPress={() => handleFolderPress(item.data.id)}
                    onRestore={() => handleRestoreFolder(item.data.id)}
                    onPermanentDelete={() =>
                        handlePermanentDeleteFolder(item.data.id, item.data.name)
                    }
                />
            );
        }

        return (
            <NoteCard
                note={item.data}
                onPress={() => handleNotePress(item.data.id)}
                onRestore={() => handleRestoreNote(item.data.id)}
                onPermanentDelete={() =>
                    handlePermanentDeleteNote(item.data.id, item.data.title)
                }
            />
        );
    };

    const getItemKey = (item: ListItem): string => {
        if (item.type === 'section-header') return `header-${item.title}`;
        return item.data.id;
    };

    const isEmpty = trashData.length === 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: headerTitle,
                    headerLeft: currentFolderId !== TRASH_FOLDER_ID
                        ? () => (
                            <Pressable onPress={handleBack} style={styles.headerButton} hitSlop={8}>
                                <Ionicons name="chevron-back" size={26} color={colors.primary} />
                            </Pressable>
                        )
                        : undefined,
                    headerRight: !isEmpty
                        ? () => (
                            <Pressable
                                onPress={handleEmptyTrash}
                                style={styles.headerButton}
                                hitSlop={8}
                            >
                                <ThemedText style={[styles.emptyTrashButton, { color: colors.primary }]}>
                                    Empty
                                </ThemedText>
                            </Pressable>
                        )
                        : undefined,
                }}
            />

            <FlatList
                data={trashData}
                keyExtractor={getItemKey}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons
                            name="trash-outline"
                            size={48}
                            color={colors.border}
                        />
                        <ThemedText style={styles.emptyText}>
                            Trash is empty
                        </ThemedText>
                        <ThemedText style={[styles.emptyHint, { color: colors.border }]}>
                            Deleted items will appear here
                        </ThemedText>
                    </View>
                }
                renderItem={renderItem}
            />

            <View style={[styles.hint, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.text + '60'} />
                <ThemedText style={[styles.hintText, { color: colors.text + '60' }]}>
                    Swipe right to restore • Long press to permanently delete
                </ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerButton: {
        padding: 4,
    },
    emptyTrashButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 12,
        marginBottom: 10,
        marginLeft: 4,
    },
    folderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        gap: 12,
    },
    folderIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    folderContent: {
        flex: 1,
    },
    folderName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    noteCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    preview: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    deletedDate: {
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        gap: 8,
    },
    emptyText: {
        fontSize: 17,
        fontWeight: '600',
    },
    emptyHint: {
        fontSize: 14,
    },
    hint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderTopWidth: 1,
    },
    hintText: {
        fontSize: 12,
    },
});
