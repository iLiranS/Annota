import FloatingActionButton from '@/components/floating-action-button';
import FolderEditModal from '@/components/folder-edit-modal';
import FolderCard from '@/components/folders/folder-card';
import NoteLocationModal from '@/components/note-location-modal';
import NoteCard from '@/components/notes/note-card';
import OptionsMenu from '@/components/options-menu';
import NotesSearchModal from '@/components/search/notes-search-modal';
import ThemedText from '@/components/themed-text';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import {
    sortFolders,
    sortNotes,
    SortType,
} from '@/dev-data/data';
import { NoteMetadata, useNotesStore, type Folder } from '@/lib/stores/notes.store';
import { useSettingsStore } from '@/lib/stores/settings.store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: NoteMetadata }
    | { type: 'section-header'; title: string };

export default function NotesList() {
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ folderId?: string, source?: string }>();



    // Zustand store
    const {
        notes,
        folders,
        createNote,
        deleteNote,
        deleteFolder,
        getFolderById,
        getNotesInFolder,
        getFoldersInFolder,
        getSortType,
        setFolderSortType,
        updateNoteMetadata,
    } = useNotesStore();

    const { general } = useSettingsStore();
    const isCompact = general.compactMode;

    const currentFolderId = params.folderId ?? null;
    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    const currentSortType = getSortType(currentFolderId);

    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Edit modal state
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [editingNote, setEditingNote] = useState<NoteMetadata | null>(null);

    // Browsing Data (Current Folder) - sorted
    const browseFolders = useMemo(() => {
        const folderList = getFoldersInFolder(currentFolderId);
        const sorted = sortFolders(folderList, currentSortType);
        const regularFolders = sorted.filter(f => !f.isSystem);
        return regularFolders as Folder[];
    }, [folders, currentFolderId, currentSortType]);

    const browseNotes = useMemo(() => {
        const noteList = getNotesInFolder(currentFolderId);
        return sortNotes(noteList, currentSortType);
    }, [notes, currentFolderId, currentSortType]);

    // Split notes into pinned and unpinned
    const { pinnedNotes, unpinnedNotes } = useMemo(() => {
        const pinned = browseNotes.filter(n => n.isPinned);
        const unpinned = browseNotes.filter(n => !n.isPinned);
        return { pinnedNotes: pinned, unpinnedNotes: unpinned };
    }, [browseNotes]);

    const browseData = useMemo((): ListItem[] => {
        const items: ListItem[] = [];

        // 1. Folders
        if (browseFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            browseFolders.forEach((f) => items.push({ type: 'folder', data: f }));
        }

        // 2. Pinned Notes
        if (pinnedNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Pinned' });
            pinnedNotes.forEach((n) => items.push({ type: 'note', data: n }));
        }

        // 3. Remaining Notes
        if (unpinnedNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            unpinnedNotes.forEach((n) => items.push({ type: 'note', data: n }));
        }

        return items;
    }, [browseFolders, pinnedNotes, unpinnedNotes]);

    const handleFolderPress = useCallback(
        (folderId: string) => {
            router.push({ pathname: '/Notes', params: { folderId } });
        },
        [router]
    );

    const handleNotePress = useCallback(
        (noteId: string) => {
            router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
        },
        [router]
    );


    // Create new note and navigate to it
    const handleCreateNote = useCallback(async () => {
        const newNote = await createNote({ folderId: currentFolderId ?? '' });
        router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'new' } });
    }, [createNote, currentFolderId, router]);

    // Change sort type
    const handleSortChange = useCallback(
        (sortType: SortType) => {
            setFolderSortType(currentFolderId, sortType);
        },
        [currentFolderId, setFolderSortType]
    );

    // Navigate to settings
    const handleSettings = useCallback(() => {
        router.push('/settings');
    }, [router]);


    // Delete handlers
    const handleDeleteFolder = useCallback(
        async (folderId: string) => {
            const folder = getFolderById(folderId);
            if (folder?.isSystem) {
                // Don't allow deleting system folders
                return;
            }
            await deleteFolder(folderId);
        },
        [deleteFolder, getFolderById]
    );

    const handleDeleteNote = useCallback(
        async (noteId: string) => {
            await deleteNote(noteId);
        },
        [deleteNote]
    );

    const handleTogglePin = useCallback(
        async (note: NoteMetadata) => {
            await updateNoteMetadata(note.id, { isPinned: !note.isPinned });
        },
        [updateNoteMetadata]
    );

    const handleToggleQuickAccess = useCallback(
        async (note: NoteMetadata) => {
            await updateNoteMetadata(note.id, { isQuickAccess: !note.isQuickAccess });
        },
        [updateNoteMetadata]
    );

    // Long press handlers for edit modals
    const handleFolderLongPress = useCallback(
        (folder: Folder) => {
            if (folder.isSystem) return; // Don't allow editing system folders
            setEditingFolder(folder);
        },
        []
    );

    const handleNoteLongPress = useCallback(
        (note: NoteMetadata) => {
            setEditingNote(note);
        },
        []
    );

    const headerTitle = currentFolder ? currentFolder.name : 'Notes';

    const renderItem = ({ item, index }: { item: ListItem, index: number }) => {
        if (item.type === 'section-header') {
            const iconName = item.title === 'Folders' ? 'folder' :
                item.title === 'Pinned' ? 'pin' : 'document-text';
            return (
                <View style={[
                    styles.sectionHeaderRow,
                    isCompact && { marginTop: 8, marginBottom: 4 },
                ]}>
                    <Ionicons name={iconName} size={14} color={colors.text + '50'} />
                    <ThemedText style={[
                        styles.sectionHeaderText,
                        { color: colors.text + '50' }
                    ]}>
                        {item.title}
                    </ThemedText>
                </View>
            );
        }

        if (item.type === 'folder') {
            const isFirstFolder = index === 0 || browseData[index - 1].type !== 'folder';
            const isLastFolder = index === browseData.length - 1 || browseData[index + 1].type !== 'folder';

            return (
                <FolderCard
                    folder={item.data}
                    onPress={() => handleFolderPress(item.data.id)}
                    onLongPress={() => handleFolderLongPress(item.data)}
                    onDelete={() => handleDeleteFolder(item.data.id)}
                    swipeable={!item.data.isSystem}
                    isFirst={isFirstFolder}
                    isLast={isLastFolder}
                />
            );
        }

        const isFirstNote = index === 0 || browseData[index - 1].type !== 'note';
        const isLastNote = index === browseData.length - 1 || browseData[index + 1].type !== 'note';

        return (
            <NoteCard
                note={item.data}
                onPress={() => handleNotePress(item.data.id)}
                onLongPress={() => handleNoteLongPress(item.data)}
                onDelete={() => handleDeleteNote(item.data.id)}
                onTogglePin={() => handleTogglePin(item.data)}
                onToggleQuickAccess={() => handleToggleQuickAccess(item.data)}
                isFirst={isFirstNote}
                isLast={isLastNote}
            />
        );
    };

    const getItemKey = (item: ListItem, index: number): string => {
        if (item.type === 'section-header') return `header-${item.title}`;
        return item.data.id;
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: headerTitle,
                    gestureEnabled: false,
                    headerLeft: () => (
                        <HapticPressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
                            <Ionicons name="chevron-back" size={26} color={colors.primary} />
                        </HapticPressable>
                    ),
                    headerRight: () => (
                        <HapticPressable
                            onPress={() => setIsSearchVisible(true)}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons name="search" size={24} color={colors.primary} />
                        </HapticPressable>
                    ),
                }}
            />

            <FlatList
                data={browseData}
                keyExtractor={getItemKey}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons
                            name="folder-open-outline"
                            size={48}
                            color={colors.border}
                        />
                        <Text style={[styles.emptyText, { color: colors.text }]}>
                            This folder is empty
                        </Text>
                        <Text style={[styles.emptyHint, { color: colors.border }]}>
                            Create a note or folder to get started
                        </Text>
                    </View>
                }
                renderItem={renderItem}
            />

            {/* Bottom Footer */}
            <View style={[
                styles.footer,
                {
                    paddingBottom: Math.max(insets.bottom, 16),
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                }
            ]}>
                <View style={styles.footerContent}>
                    <View style={styles.footerSide} />

                    <FloatingActionButton
                        onPress={handleCreateNote}
                        isFloating={false}
                        size={52}
                    />

                    <View style={styles.footerSide}>
                        <OptionsMenu
                            currentSortType={currentSortType}
                            onNewFolder={() => setIsCreatingFolder(true)}
                            onSortChange={handleSortChange}
                            onTrash={() => router.push('/Notes/trash')}
                            onSettings={handleSettings}
                        />
                    </View>
                </View>
            </View>

            {/* Folder Create Modal */}
            <FolderEditModal
                visible={isCreatingFolder}
                folder={null}
                defaultParentId={currentFolderId}
                onClose={() => setIsCreatingFolder(false)}
            />

            {/* Folder Edit Modal */}
            <FolderEditModal
                visible={editingFolder !== null}
                folder={editingFolder}
                onClose={() => setEditingFolder(null)}
            />

            {/* Note Location Modal */}
            <NoteLocationModal
                visible={editingNote !== null}
                note={editingNote}
                onClose={() => setEditingNote(null)}
            />

            {/* Search Modal */}
            <NotesSearchModal
                visible={isSearchVisible}
                onClose={() => setIsSearchVisible(false)}
                onFolderPress={handleFolderPress}
                onNotePress={handleNotePress}
                onFolderLongPress={handleFolderLongPress}
                onNoteLongPress={handleNoteLongPress}
                allFolders={folders}
                allNotes={notes}
                browseFolders={browseFolders}
                browseNotes={browseNotes}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 16,
    },
    headerButton: {
        padding: 4,
    },
    listContent: {
        paddingBottom: 100,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 16,
        marginBottom: 8,
        gap: 6,
    },
    sectionHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
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
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        paddingTop: 12,
        paddingHorizontal: 20,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerSide: {
        flex: 1,
        alignItems: 'flex-end',
    },
});
