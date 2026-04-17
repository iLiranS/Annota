import FloatingActionButton from '@/components/floating-action-button';
import FolderEditModal from '@/components/folder-edit-modal';
import FolderCard from '@/components/folders/folder-card';
import NoteLocationModal from '@/components/note-location-modal';
import NoteCard from '@/components/notes/note-card';
import { SectionHeader } from '@/components/notes/section-header';
import OptionsMenu from '@/components/options-menu';
import ThemedText from '@/components/themed-text';
import { DailyNoteIcon } from '@/components/ui/daily-note-icon';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useSidebar } from '@/context/sidebar-context';
import {
    DAILY_NOTES_FOLDER_ID,
    NoteMetadata,
    sortFolders,
    sortNotes,
    useNotesStore,
    useSearchStore,
    useSettingsStore,
    useSyncStore,
    type Folder
} from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TextInput,
    View
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeIn,
    FadeOut,
    interpolate,
    LinearTransition,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: NoteMetadata; subtitle?: string }
    | { type: 'section-header'; title: string };

export default function NotesList() {
    const router = useRouter();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ folderId?: string, tagId?: string, source?: string }>();

    // Stores
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
        tags
    } = useNotesStore();

    const {
        setSearchQuery,
        dbResults,
        resetSearch,
        isSearching
    } = useSearchStore();


    const { general } = useSettingsStore();
    const { toggle } = useSidebar();
    const isSyncing = useSyncStore(state => state.isSyncing);

    // Params & State
    const currentFolderId = params.folderId ?? null;
    const tagId = params.tagId ?? null;
    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    const currentSortType = getSortType(currentFolderId);
    const isCompact = general.compactMode;

    const [isSearchActive, setIsSearchActive] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');


    // Sync local query only when it's cleared from outside
    useEffect(() => {
        const unsubscribe = useSearchStore.subscribe(
            (state) => state.searchQuery,
            (query) => {
                if (query === '' && localSearchQuery !== '') {
                    setLocalSearchQuery('');
                }
            }
        );
        return unsubscribe;
    }, [localSearchQuery]);


    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [editingNote, setEditingNote] = useState<NoteMetadata | null>(null);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const searchInputRef = useRef<TextInput>(null);
    const scrollY = useSharedValue(0);

    const currentTag = useMemo(() => tags.find(t => t.id === tagId), [tags, tagId]);
    const headerTitle = tagId ? (currentTag?.name ?? 'Tag') : (currentFolder ? currentFolder.name : 'Annota');

    // Handlers
    const toggleSection = useCallback((title: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    }, []);

    const triggerSync = useCallback(async () => {
        try {
            await useSyncStore.getState().forceSync();
        } catch (e) {
            console.error('[Manual Sync]', e);
        }
    }, []);

    const handleCloseSearch = useCallback(() => {
        setIsSearchActive(false);
        setLocalSearchQuery('');
        resetSearch();
    }, [resetSearch]);

    const handleSearchChange = useCallback((text: string) => {
        setLocalSearchQuery(text);
        setSearchQuery(text, currentFolderId);
    }, [setSearchQuery, currentFolderId]);

    const handleNotePress = useCallback((noteId: string) => {
        if (isSearchActive) handleCloseSearch();
        router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
    }, [router, isSearchActive, handleCloseSearch]);

    const handleFolderPress = useCallback((folderId: string) => {
        if (isSearchActive) handleCloseSearch();
        router.push({ pathname: '/Notes', params: { folderId } });
    }, [router, isSearchActive, handleCloseSearch]);

    const handleCreateNote = useCallback(async () => {
        const { data: newNote, error } = await createNote({
            folderId: currentFolderId ?? '',
            tags: tagId ? JSON.stringify([tagId]) : undefined
        });
        if (error) {
            Toast.show({ type: 'error', text1: 'Failed to create note', text2: error });
            return;
        }
        if (newNote) {
            router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'new' } });
        }
    }, [createNote, currentFolderId, router, tagId]);

    // Data filtering & sorting
    const browseFolders = useMemo(() => {
        if (tagId || isSearchActive) return [];
        const folderList = getFoldersInFolder(currentFolderId);
        return sortFolders(folderList, currentSortType).filter(f => !f.isSystem);
    }, [folders, currentFolderId, currentSortType, tagId, isSearchActive]);

    const browseNotes = useMemo(() => {
        if (tagId) {
            const list = notes.filter(n => {
                try {
                    const tagIds = JSON.parse(n.tags || '[]') as string[];
                    return tagIds.includes(tagId) && !n.isDeleted && !n.isPermDeleted;
                } catch { return false; }
            });
            return sortNotes(list, currentSortType);
        }
        return sortNotes(getNotesInFolder(currentFolderId), currentSortType);
    }, [notes, currentFolderId, currentSortType, tagId]);

    const displayData = useMemo((): ListItem[] => {
        if (isSearchActive) {
            const items: ListItem[] = [];
            const searchFolders = dbResults.filter(r => r.type === 'folder');
            const searchNotes = dbResults.filter(r => r.type === 'note');

            if (searchFolders.length > 0) {
                items.push({ type: 'section-header', title: 'Folders' });
                searchFolders.forEach(f => items.push({ type: 'folder', data: f.data }));
            }
            if (searchNotes.length > 0) {
                items.push({ type: 'section-header', title: 'Notes' });
                searchNotes.forEach(n => items.push({ type: 'note', data: n.data, subtitle: n.subtitle }));
            }
            return items;
        }

        const items: ListItem[] = [];
        if (browseFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            if (!collapsedSections.has('Folders')) {
                browseFolders.forEach(f => items.push({ type: 'folder', data: f }));
            }
        }

        const pinned = browseNotes.filter(n => n.isPinned);
        if (pinned.length > 0) {
            items.push({ type: 'section-header', title: 'Pinned' });
            if (!collapsedSections.has('Pinned')) {
                pinned.forEach(n => items.push({ type: 'note', data: n }));
            }
        }

        const unpinned = browseNotes.filter(n => !n.isPinned);
        if (unpinned.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            if (!collapsedSections.has('Notes')) {
                unpinned.forEach(n => items.push({ type: 'note', data: n }));
            }
        }
        return items;
    }, [browseFolders, browseNotes, isSearchActive, dbResults, collapsedSections]);

    // Animations & Scroll
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { scrollY.value = event.contentOffset.y; },
        onEndDrag: (event) => { if (event.contentOffset.y < -80) runOnJS(triggerSync)(); },
    });

    const syncIndicatorStyle = useAnimatedStyle(() => {
        const pullProgress = interpolate(scrollY.value, [-80, 0], [1, 0], Extrapolation.CLAMP);
        return {
            position: 'absolute', top: 0, left: 0, height: 2, zIndex: 1000,
            width: isSyncing ? '100%' : `${pullProgress * 100}%`,
            backgroundColor: colors.primary,
            opacity: isSyncing ? withTiming(1) : (pullProgress > 0 ? 1 : 0),
        };
    });

    const renderItem = ({ item, index }: { item: ListItem, index: number }) => {
        if (item.type === 'section-header') {
            return (
                <SectionHeader
                    title={item.title}
                    iconName={item.title === 'Folders' ? 'folder' : item.title === 'Pinned' ? 'pin' : 'document-text'}
                    isCollapsed={collapsedSections.has(item.title)}
                    onToggle={() => toggleSection(item.title)}
                    colors={colors}
                />
            );
        }

        if (item.type === 'folder') {
            const isFirst = index === 0 || displayData[index - 1].type !== 'folder';
            const isLast = index === displayData.length - 1 || displayData[index + 1].type !== 'folder';
            return (
                <Animated.View layout={LinearTransition} entering={FadeIn} exiting={FadeOut}>
                    <FolderCard
                        folder={item.data}
                        onPress={() => handleFolderPress(item.data.id)}
                        onLongPress={() => !item.data.isSystem && setEditingFolder(item.data)}
                        onDelete={() => !item.data.isSystem && deleteFolder(item.data.id)}
                        searchQuery={isSearchActive ? localSearchQuery : undefined}

                        swipeable={!item.data.isSystem}
                        isFirst={isFirst} isLast={isLast}
                    />
                </Animated.View>
            );
        }

        const isFirst = index === 0 || displayData[index - 1].type !== 'note';
        const isLast = index === displayData.length - 1 || displayData[index + 1].type !== 'note';
        return (
            <Animated.View layout={LinearTransition} entering={FadeIn} exiting={FadeOut}>
                <NoteCard
                    note={item.data}
                    onPress={() => handleNotePress(item.data.id)}
                    onLongPress={() => setEditingNote(item.data)}
                    onDelete={() => deleteNote(item.data.id)}
                    onTogglePin={() => updateNoteMetadata(item.data.id, { isPinned: !item.data.isPinned })}
                    onToggleQuickAccess={() => updateNoteMetadata(item.data.id, { isQuickAccess: !item.data.isQuickAccess })}
                    searchQuery={isSearchActive ? localSearchQuery : undefined}

                    customPreview={item.subtitle}
                    isFirst={isFirst} isLast={isLast}
                />
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <Animated.View style={syncIndicatorStyle} />
            <Stack.Screen
                options={{
                    headerShown: true,
                    gestureEnabled: false,
                    headerBackVisible: false,
                    headerTitle: () => (


                        isSearchActive ? (
                            <View style={styles.searchInputContainer}>
                                <TextInput
                                    ref={searchInputRef}
                                    style={[styles.searchInput, { color: colors.text }]}
                                    placeholder="Search notes & folders..."
                                    placeholderTextColor={colors.text + '50'}
                                    value={localSearchQuery}
                                    onChangeText={handleSearchChange}
                                    autoFocus
                                />

                            </View>
                        ) : (
                            <View style={styles.headerTitleContainer}>
                                {tagId ? (
                                    <Ionicons name="ellipse" size={12} color={currentTag?.color ?? colors.primary} />
                                ) : currentFolderId === DAILY_NOTES_FOLDER_ID ? (
                                    <DailyNoteIcon size={18} color={currentFolder?.color ?? colors.primary} />
                                ) : (
                                    <Ionicons
                                        name={(currentFolder?.icon as any) || (currentFolderId ? 'folder' : 'documents')}
                                        size={18}
                                        color={currentFolder?.color ?? colors.primary}
                                    />
                                )}
                                <ThemedText style={styles.headerTitleText}>{headerTitle}</ThemedText>
                            </View>
                        )
                    ),
                    headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => {
                        if (isSearchActive) return null;
                        return (
                            <HapticPressable
                                onPress={() => canGoBack ? router.back() : toggle()}
                                style={[styles.headerButton, styles.headerLeftButton]}
                                hitSlop={8}
                            >
                                <Ionicons name={canGoBack ? "chevron-back" : "menu-outline"} size={24} color={colors.primary} />
                            </HapticPressable>
                        );
                    },
                    headerRight: () => (
                        <HapticPressable
                            onPress={() => isSearchActive ? handleCloseSearch() : setIsSearchActive(true)}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons name={isSearchActive ? "close" : "search"} size={24} color={colors.primary} />
                        </HapticPressable>
                    ),
                }}
            />

            <Animated.FlatList
                data={displayData}
                keyExtractor={(item, index) => item.type === 'section-header' ? `h-${item.title}` : item.data.id}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
                itemLayoutAnimation={LinearTransition}
                renderItem={renderItem}
                ListHeaderComponent={isSearching ? (
                    <View style={styles.searchLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <ThemedText style={styles.searchLoadingText}>Searching...</ThemedText>
                    </View>
                ) : null}
                ListEmptyComponent={isSearchActive ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={colors.border} />
                        <ThemedText style={styles.emptyText}>{localSearchQuery ? 'No results found' : 'Type to search...'}</ThemedText>
                    </View>
                ) : (

                    <View style={styles.emptyContainer}>
                        <Ionicons name={tagId ? "pricetag-outline" : "folder-open-outline"} size={48} color={colors.border} />
                        <ThemedText style={styles.emptyText}>{tagId ? 'No tagged notes' : 'This folder is empty'}</ThemedText>
                        <ThemedText style={styles.emptyHint}>{tagId ? 'Tag notes to see them here' : 'Create something to get started'}</ThemedText>
                    </View>
                )}
                ListFooterComponent={<View style={{ height: 100 }} />}
            />

            {/* Bottom Footer */}
            {!isSearchActive && (
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
                        <FloatingActionButton onPress={handleCreateNote} isFloating={false} size={64} style={{ marginTop: -32 }} />
                        <View style={styles.footerSide}>
                            <OptionsMenu
                                currentSortType={currentSortType}
                                onNewFolder={() => setIsCreatingFolder(true)}
                                onSortChange={(s) => setFolderSortType(currentFolderId, s)}
                                onTrash={() => router.push('/Notes/trash')}
                                onSettings={() => router.push('/settings')}
                            />
                        </View>
                    </View>
                </View>
            )}

            <FolderEditModal
                visible={isCreatingFolder || !!editingFolder}
                folder={editingFolder}
                defaultParentId={currentFolderId}
                onClose={() => { setIsCreatingFolder(false); setEditingFolder(null); }}
            />
            <NoteLocationModal visible={!!editingNote} note={editingNote} onClose={() => setEditingNote(null)} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerLeftButton: { marginLeft: -4 },
    listContent: { paddingTop: 16 },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitleText: { fontSize: 18, fontWeight: '700' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
    emptyText: { fontSize: 17, fontWeight: '600' },
    emptyHint: { fontSize: 14, opacity: 0.5 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1 },
    footerContent: { flexDirection: 'row', justifyContent: 'space-between' },
    footerSide: { flex: 1, alignItems: 'flex-end', paddingTop: 10, minHeight: 48, marginRight: 15 },
    searchInputContainer: { flex: 1, height: 40, justifyContent: 'center' },
    searchInput: { fontSize: 16, fontWeight: '500', paddingHorizontal: 12 },
    searchLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
    searchLoadingText: { fontSize: 13, opacity: 0.6 },
});
