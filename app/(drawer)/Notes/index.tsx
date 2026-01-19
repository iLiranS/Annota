import FloatingActionButton from '@/components/floating-action-button';
import FolderEditModal from '@/components/folder-edit-modal';
import NoteLocationModal from '@/components/note-location-modal';
import OptionsMenu from '@/components/options-menu';
import SwipeableItem from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import {
    sortFolders,
    sortNotes,
    SortType,
} from '@/dev-data/data';
import { NoteMetadata, TRASH_FOLDER_ID, useNotesStore, type Folder } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DrawerActions, useTheme } from '@react-navigation/native';
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';

import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FolderItemProps {
    folder: Folder;
    onPress: () => void;
    onLongPress: () => void;
    onDelete: () => void;
}

function FolderCard({ folder, onPress, onLongPress, onDelete }: FolderItemProps) {
    const { colors, dark } = useTheme();

    return (
        <SwipeableItem onDelete={onDelete}>
            <ThemedPressable
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                    styles.folderCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                    pressed && styles.pressed,
                ]}
            >
                <View style={[styles.folderIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                    <Ionicons name={folder.icon as keyof typeof Ionicons.glyphMap} size={22} color="#F59E0B" />
                </View>
                <ThemedText style={styles.folderName}>{folder.name}</ThemedText>
                <Ionicons name="chevron-forward" size={18} color={colors.text + '50'} />
            </ThemedPressable>
        </SwipeableItem>
    );
}

interface NoteItemProps {
    note: NoteMetadata;
    onPress: () => void;
    onLongPress: () => void;
    onDelete: () => void;
}

function NoteCard({ note, onPress, onLongPress, onDelete }: NoteItemProps) {
    const { colors, dark } = useTheme();

    const formatDate = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <SwipeableItem onDelete={onDelete}>
            <ThemedPressable
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                    styles.noteCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                    pressed && styles.pressed,
                ]}
            >
                <View style={styles.noteHeader}>
                    <View style={styles.titleRow}>
                        <Ionicons name="document-text" size={16} color="#6366F1" />
                        <ThemedText style={styles.title}>{note.title}</ThemedText>
                    </View>
                    <View style={styles.timestampRow}>
                        <ThemedText style={[styles.timestamp, { color: colors.text + '60' }]}>
                            {formatDate(note.updatedAt)}
                        </ThemedText>
                    </View>
                </View>
                <ThemedText
                    style={[styles.preview, { color: colors.text + '70' }]}
                    numberOfLines={1}
                >
                    {note.preview}
                </ThemedText>
            </ThemedPressable>
        </SwipeableItem>
    );
}

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: NoteMetadata }
    | { type: 'section-header'; title: string };

export default function NotesList() {
    const router = useRouter();
    const navigation = useNavigation();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ folderId?: string }>();

    const openDrawer = useCallback(() => {
        navigation.dispatch(DrawerActions.openDrawer());
    }, [navigation]);

    // Zustand store
    const {
        notes,
        folders,
        createNote,
        updateFolder,
        deleteNote,
        deleteFolder,
        getFolderById,
        getNotesInFolder,
        getFoldersInFolder,
        getSortType,
        setFolderSortType,
        loadNotesInFolder,
        loadFoldersInFolder,
    } = useNotesStore();

    const currentFolderId = params.folderId ?? null;
    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;
    const currentSortType = getSortType(currentFolderId);

    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Edit modal state
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [editingNote, setEditingNote] = useState<NoteMetadata | null>(null);

    // Search scope state
    const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');

    // Load data from database when folder changes or screen is focused
    useFocusEffect(
        useCallback(() => {
            loadNotesInFolder(currentFolderId);
            loadFoldersInFolder(currentFolderId);
        }, [currentFolderId, loadNotesInFolder, loadFoldersInFolder])
    );

    // Browsing Data (Current Folder) - sorted
    const browseFolders = useMemo(() => {
        const folderList = getFoldersInFolder(currentFolderId);
        const sorted = sortFolders(folderList, currentSortType);
        // Ensure Trash folder appears at the bottom
        const systemFolders = sorted.filter(f => f.isSystem);
        const regularFolders = sorted.filter(f => !f.isSystem);
        return [...regularFolders, ...systemFolders] as Folder[];
    }, [folders, currentFolderId, currentSortType]);

    const browseNotes = useMemo(() => {
        const noteList = getNotesInFolder(currentFolderId);
        return sortNotes(noteList, currentSortType);
    }, [notes, currentFolderId, currentSortType]);

    const browseData = useMemo((): ListItem[] => {
        const items: ListItem[] = [];
        if (browseFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            browseFolders.forEach((f) => items.push({ type: 'folder', data: f }));
        }
        if (browseNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            browseNotes.forEach((n) => items.push({ type: 'note', data: n }));
        }
        return items;
    }, [browseFolders, browseNotes]);

    // Search Data (Filtered based on Scope)
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const source = searchScope === 'all' ? folders : browseFolders;
        return source.filter((f) => f.name.toLowerCase().includes(query));
    }, [folders, browseFolders, searchQuery, searchScope]);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const source = searchScope === 'all' ? notes : browseNotes;
        return source.filter(
            (n) =>
                n.title.toLowerCase().includes(query) ||
                n.preview.toLowerCase().includes(query)
        );
    }, [notes, browseNotes, searchQuery, searchScope]);

    const searchData = useMemo((): ListItem[] => {
        if (!searchQuery.trim()) return [];
        const items: ListItem[] = [];
        if (filteredFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            filteredFolders.forEach((f) => items.push({ type: 'folder', data: f }));
        }
        if (filteredNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            filteredNotes.forEach((n) => items.push({ type: 'note', data: n }));
        }
        return items;
    }, [filteredFolders, filteredNotes, searchQuery]);

    const handleFolderPress = useCallback(
        (folderId: string) => {
            const folder = getFolderById(folderId);
            // Navigate to dedicated trash screen for system trash folder
            if (folder?.isSystem && folder.id === TRASH_FOLDER_ID) {
                router.push('/Notes/trash');
                return;
            }
            setIsSearchVisible(false);
            setSearchQuery('');
            router.setParams({ folderId });
        },
        [router, getFolderById]
    );

    const handleNotePress = useCallback(
        (noteId: string) => {
            setIsSearchVisible(false);
            setSearchQuery('');
            router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
        },
        [router]
    );

    const handleBack = useCallback(() => {
        if (currentFolder?.parentId) {
            router.setParams({ folderId: currentFolder.parentId });
        } else {
            router.setParams({ folderId: undefined });
        }
    }, [currentFolder, router]);

    // Create new note and navigate to it
    const handleCreateNote = useCallback(() => {
        const newNote = createNote(currentFolderId);
        router.push({ pathname: '/Notes/[id]', params: { id: newNote.id } });
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

    // Navigate to trash
    const handleTrash = useCallback(() => {
        router.push('/Notes/trash');
    }, [router]);

    // Delete handlers
    const handleDeleteFolder = useCallback(
        (folderId: string) => {
            const folder = getFolderById(folderId);
            if (folder?.isSystem) {
                // Don't allow deleting system folders
                return;
            }
            deleteFolder(folderId);
        },
        [deleteFolder, getFolderById]
    );

    const handleDeleteNote = useCallback(
        (noteId: string) => {
            deleteNote(noteId);
        },
        [deleteNote]
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

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === 'section-header') {
            return (
                <ThemedText style={[styles.sectionHeader, { color: colors.text + '60' }]}>
                    {item.title}
                </ThemedText>
            );
        }

        if (item.type === 'folder') {
            // Don't allow swiping system folders (like Trash)
            if (item.data.isSystem) {
                const iconColor = item.data.id === TRASH_FOLDER_ID ? '#EF4444' : '#F59E0B';
                return (
                    <ThemedPressable
                        onPress={() => handleFolderPress(item.data.id)}
                        style={({ pressed }) => [
                            styles.folderCard,
                            {
                                backgroundColor: colors.card,
                                borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                marginTop: 16, // Add spacing before system folders
                            },
                            pressed && styles.pressed,
                        ]}
                    >
                        <View style={[styles.folderIcon, { backgroundColor: iconColor + '20' }]}>
                            <Ionicons name={item.data.icon as keyof typeof Ionicons.glyphMap} size={22} color={iconColor} />
                        </View>
                        <ThemedText style={styles.folderName}>{item.data.name}</ThemedText>
                        <Ionicons name="chevron-forward" size={18} color={colors.text + '50'} />
                    </ThemedPressable>
                );
            }
            return (
                <FolderCard
                    folder={item.data}
                    onPress={() => handleFolderPress(item.data.id)}
                    onLongPress={() => handleFolderLongPress(item.data)}
                    onDelete={() => handleDeleteFolder(item.data.id)}
                />
            );
        }

        return (
            <NoteCard
                note={item.data}
                onPress={() => handleNotePress(item.data.id)}
                onLongPress={() => handleNoteLongPress(item.data)}
                onDelete={() => handleDeleteNote(item.data.id)}
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
                    headerLeft: () => currentFolderId
                        ? (
                            <Pressable onPress={handleBack} style={styles.headerButton} hitSlop={8}>
                                <Ionicons name="chevron-back" size={26} color={colors.primary} />
                            </Pressable>
                        )
                        : (
                            <Pressable onPress={openDrawer} style={styles.headerButton} hitSlop={8}>
                                <Ionicons name="menu" size={26} color={colors.primary} />
                            </Pressable>
                        ),
                    headerRight: () => (
                        <Pressable
                            onPress={() => setIsSearchVisible(true)}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons name="search" size={24} color={colors.primary} />
                        </Pressable>
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

            {/* Floating Action Button for New Note */}
            <FloatingActionButton onPress={handleCreateNote} />

            {/* Options Menu */}
            <OptionsMenu
                currentSortType={currentSortType}
                onNewFolder={() => setIsCreatingFolder(true)}
                onSortChange={handleSortChange}
                onTrash={handleTrash}
                onSettings={handleSettings}
            />

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
            <Modal
                visible={isSearchVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsSearchVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsSearchVisible(false)} />

                    <View
                        style={[
                            styles.searchContainer,
                            {
                                backgroundColor: colors.card,
                                marginTop: insets.top + 12,
                                maxHeight: '80%',
                            },
                        ]}
                    >
                        <View style={styles.searchInputWrapper}>
                            <Ionicons
                                name="search"
                                size={18}
                                color={colors.text}
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder={searchScope === 'all' ? "Search all notes..." : "Search in this folder..."}
                                placeholderTextColor={'#888'}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color={colors.text} />
                                </Pressable>
                            )}
                        </View>

                        {/* Search Scope Toggle */}
                        <View style={[styles.scopeToggle, { backgroundColor: colors.background }]}>
                            <Pressable
                                style={[
                                    styles.scopeButton,
                                    searchScope === 'current' && { backgroundColor: colors.primary }
                                ]}
                                onPress={() => setSearchScope('current')}
                            >
                                <Text style={[
                                    styles.scopeText,
                                    { color: searchScope === 'current' ? '#FFFFFF' : colors.text }
                                ]}>Current Folder</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.scopeButton,
                                    searchScope === 'all' && { backgroundColor: colors.primary }
                                ]}
                                onPress={() => setSearchScope('all')}
                            >
                                <Text style={[
                                    styles.scopeText,
                                    { color: searchScope === 'all' ? '#FFFFFF' : colors.text }
                                ]}>All Notes</Text>
                            </Pressable>
                        </View>

                        {/* Search Results List */}
                        {searchQuery.length > 0 && (
                            <FlatList
                                data={searchData}
                                keyExtractor={getItemKey}
                                renderItem={renderItem}
                                contentContainerStyle={styles.searchListContent}
                                keyboardShouldPersistTaps="handled"
                                ListEmptyComponent={
                                    <Text style={[styles.searchHint, { color: colors.text }]}>
                                        No results found
                                    </Text>
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>
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
        gap: 12,
    },
    folderIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    folderName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    noteCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
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
    timestampRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timestamp: {
        fontSize: 12,
    },
    preview: {
        fontSize: 14,
        lineHeight: 20,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
    },
    searchContainer: {
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchIcon: {
        opacity: 0.6,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
    },
    searchHint: {
        marginTop: 20,
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.6,
    },
    scopeToggle: {
        flexDirection: 'row',
        marginTop: 12,
        marginBottom: 8,
        borderRadius: 8,
        padding: 2,
        overflow: 'hidden',
    },
    scopeButton: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    scopeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    searchListContent: {
        paddingTop: 8,
        paddingBottom: 20,
    }
});
