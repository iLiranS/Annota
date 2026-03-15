import FloatingActionButton from '@/components/floating-action-button';
import FolderEditModal from '@/components/folder-edit-modal';
import FolderCard from '@/components/folders/folder-card';
import NoteLocationModal from '@/components/note-location-modal';
import NoteCard from '@/components/notes/note-card';
import OptionsMenu from '@/components/options-menu';
import NotesSearchModal from '@/components/search/notes-search-modal';
import { CompactTaskCard } from '@/components/tasks/TaskCard';
import ThemedText from '@/components/themed-text';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import {
    NoteMetadata,
    sortFolders,
    sortNotes,
    SortType,
    useNotesStore,
    useSettingsStore,
    useTasksStore,
    type Folder,
} from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: NoteMetadata }
    | { type: 'section-header'; title: string };

interface SectionHeaderProps {
    title: string;
    iconName: keyof typeof Ionicons.glyphMap;
    isCollapsed: boolean;
    onToggle: () => void;
    colors: any;
    isCompact: boolean;
}

const SectionHeader = ({ title, iconName, isCollapsed, onToggle, colors, isCompact }: SectionHeaderProps) => {
    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{
            rotate: withTiming(!isCollapsed ? '90deg' : '0deg', {
                duration: 300,
                easing: Easing.bezier(0.4, 0, 0.2, 1)
            })
        }]
    }));

    return (
        <HapticPressable
            onPress={onToggle}
            style={[
                styles.sectionHeaderRow,
            ]}
        >
            <Ionicons name={iconName} size={14} color={colors.text + '50'} />
            <ThemedText style={[
                styles.sectionHeaderText,
                { color: colors.text + '50', flex: 1 }
            ]}>
                {title}
            </ThemedText>
            <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-forward" size={16} color={colors.text + '50'} />
            </Animated.View>
        </HapticPressable>
    );
};

export default function NotesList() {
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ folderId?: string, tagId?: string, source?: string }>();



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
    const { tasks, toggleComplete } = useTasksStore();

    const { general } = useSettingsStore();
    const isCompact = general.compactMode;

    const currentFolderId = params.folderId ?? null;
    const tagId = params.tagId ?? null;
    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    const currentSortType = getSortType(currentFolderId);

    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Collapsed sections state
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const toggleSection = useCallback((title: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    }, []);

    // Edit modal state
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [editingNote, setEditingNote] = useState<NoteMetadata | null>(null);

    // Browsing Data (Current Folder) - sorted
    const browseFolders = useMemo(() => {
        if (tagId) return [];
        const folderList = getFoldersInFolder(currentFolderId);
        const sorted = sortFolders(folderList, currentSortType);
        const regularFolders = sorted.filter(f => !f.isSystem);
        return regularFolders as Folder[];
    }, [folders, currentFolderId, currentSortType, tagId]);

    const browseNotes = useMemo(() => {
        if (tagId) {
            const list = notes.filter(n => {
                if (!n.tags) return false;
                try {
                    const tagIds = JSON.parse(n.tags) as string[];
                    return tagIds.includes(tagId) && !n.isDeleted && !n.isPermDeleted;
                } catch { return false; }
            });
            return sortNotes(list, currentSortType);
        }
        const noteList = getNotesInFolder(currentFolderId);
        return sortNotes(noteList, currentSortType);
    }, [notes, currentFolderId, currentSortType, tagId]);

    // Split notes into pinned and unpinned
    const { pinnedNotes, unpinnedNotes } = useMemo(() => {
        const pinned = browseNotes.filter(n => n.isPinned);
        const unpinned = browseNotes.filter(n => !n.isPinned);
        return { pinnedNotes: pinned, unpinnedNotes: unpinned };
    }, [browseNotes]);

    const folderTasks = useMemo(() => {
        if (!currentFolderId || tagId) return [];
        return tasks.filter(t => t.folderId === currentFolderId && !t.completed);
    }, [tasks, currentFolderId, tagId]);

    const browseData = useMemo((): ListItem[] => {
        const items: ListItem[] = [];

        // 1. Folders
        if (browseFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            if (!collapsedSections.has('Folders')) {
                browseFolders.forEach((f) => items.push({ type: 'folder', data: f }));
            }
        }

        // 2. Pinned Notes
        if (pinnedNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Pinned' });
            if (!collapsedSections.has('Pinned')) {
                pinnedNotes.forEach((n) => items.push({ type: 'note', data: n }));
            }
        }

        // 3. Remaining Notes
        if (unpinnedNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            if (!collapsedSections.has('Notes')) {
                unpinnedNotes.forEach((n) => items.push({ type: 'note', data: n }));
            }
        }

        return items;
    }, [browseFolders, pinnedNotes, unpinnedNotes, collapsedSections]);

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

    // Create new task and navigate to it
    const handleCreateTask = useCallback(async () => {
        router.push({ pathname: '/Tasks/new', params: { folderId: currentFolderId ?? '' } });
    }, [currentFolderId, router]);

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

    const { tags } = useNotesStore();
    const currentTag = useMemo(() => tags.find(t => t.id === tagId), [tags, tagId]);
    const headerTitle = tagId ? (currentTag?.name ?? 'Tag') : (currentFolder ? currentFolder.name : 'Notes');

    const renderItem = ({ item, index }: { item: ListItem, index: number }) => {
        if (item.type === 'section-header') {
            const isCollapsed = collapsedSections.has(item.title);
            const iconName = item.title === 'Folders' ? 'folder' :
                item.title === 'Pinned' ? 'pin' : 'document-text';

            return (
                <SectionHeader
                    title={item.title}
                    iconName={iconName}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleSection(item.title)}
                    colors={colors}
                    isCompact={isCompact}
                />
            );
        }

        if (item.type === 'folder') {
            const isFirstFolder = index === 0 || browseData[index - 1].type !== 'folder';
            const isLastFolder = index === browseData.length - 1 || browseData[index + 1].type !== 'folder';

            return (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    layout={LinearTransition.duration(300).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                >
                    <FolderCard
                        folder={item.data}
                        onPress={() => handleFolderPress(item.data.id)}
                        onLongPress={() => handleFolderLongPress(item.data)}
                        onDelete={() => handleDeleteFolder(item.data.id)}
                        swipeable={!item.data.isSystem}
                        isFirst={isFirstFolder}
                        isLast={isLastFolder}
                    />
                </Animated.View>
            );
        }

        const isFirstNote = index === 0 || browseData[index - 1].type !== 'note';
        const isLastNote = index === browseData.length - 1 || browseData[index + 1].type !== 'note';

        return (
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                layout={LinearTransition.duration(300).easing(Easing.bezier(0.4, 0, 0.2, 1))}
            >
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
            </Animated.View>
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

            <Animated.FlatList
                data={browseData}
                keyExtractor={getItemKey}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: folderTasks.length > 0 ? 0 : 100 }
                ]}
                itemLayoutAnimation={LinearTransition.duration(300).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        {tagId ? (
                            <Ionicons name="pricetag-outline" size={48} color={colors.border} />
                        ) : (
                            <Ionicons name="folder-open-outline" size={48} color={colors.border} />
                        )}
                        <Text style={[styles.emptyText, { color: colors.text }]}>
                            {tagId ? 'No notes with this tag' : 'This folder is empty'}
                        </Text>
                        <Text style={[styles.emptyHint, { color: colors.border }]}>
                            {tagId ? 'Tag some notes to see them here' : 'Create a note or folder to get started'}
                        </Text>
                    </View>
                }
                renderItem={renderItem}
            />

            {/* Tasks section - Fixed at bottom */}
            {folderTasks.length > 0 && (
                <View style={[
                    styles.tasksContainer,
                    {
                        borderTopColor: colors.border,
                        backgroundColor: colors.background,
                    }
                ]}>
                    <View style={styles.tasksHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={colors.text + '60'} />
                            <ThemedText style={styles.tasksHeaderText}>Active Tasks</ThemedText>
                        </View>
                        <ThemedText style={{ fontSize: 10, color: colors.text + '40', fontWeight: '500' }}>
                            {folderTasks.length}
                        </ThemedText>
                    </View>
                    <Animated.ScrollView
                        style={{ maxHeight: 150 }}
                        contentContainerStyle={{ gap: 4, paddingBottom: 10 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {folderTasks.map((task) => (
                            <CompactTaskCard
                                key={task.id}
                                task={task}
                                onToggle={() => toggleComplete(task.id)}
                                onPress={() => router.push(`/Tasks/${task.id}`)}
                                hideFolder={true}
                            />
                        ))}
                    </Animated.ScrollView>
                </View>
            )}

            {/* Bottom Footer */}
            <View style={[
                styles.footer,
                {
                    paddingBottom: Math.max(insets.bottom, 10),
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                }
            ]}>
                <View style={styles.footerContent}>
                    <View style={styles.footerSide} />

                    <FloatingActionButton
                        onPress={handleCreateNote}
                        isFloating={false}
                        size={64}
                        style={{ marginTop: -32 }}
                    />

                    <View style={styles.footerSide}>
                        <OptionsMenu
                            currentSortType={currentSortType}
                            onNewFolder={() => setIsCreatingFolder(true)}
                            onNewTask={handleCreateTask}
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
        marginVertical: 8,
        gap: 6,

    },
    sectionHeaderText: {
        fontSize: 14,
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
        paddingTop: 0,
        paddingHorizontal: 20,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    footerSide: {
        flex: 1,
        alignItems: 'flex-end',
        paddingTop: 10,
        minHeight: 48,
    },
    tasksContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        maxHeight: 280,
        paddingBottom: 110, // Account for absolute footer and FAB
    },
    tasksHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    tasksHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        opacity: 0.6,
    },
});
