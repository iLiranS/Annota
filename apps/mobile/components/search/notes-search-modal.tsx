import FolderCard from '@/components/folders/folder-card';
import NoteCard from '@/components/notes/note-card';
import ThemedText from '@/components/themed-text';
import { Folder, NoteMetadata, useNotesStore } from '@annota/core';
import { useSettingsStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: NoteMetadata }
    | { type: 'section-header'; title: string };

interface NotesSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onFolderPress: (folderId: string) => void;
    onNotePress: (noteId: string) => void;
    onFolderLongPress?: (folder: Folder) => void;
    onNoteLongPress?: (note: NoteMetadata) => void;
    allFolders: Folder[];
    allNotes: NoteMetadata[];
    browseFolders: Folder[];
    browseNotes: NoteMetadata[];
}

export default function NotesSearchModal({
    visible,
    onClose,
    onFolderPress,
    onNotePress,

    onFolderLongPress,
    onNoteLongPress,
    allFolders,
    allNotes,
    browseFolders,
    browseNotes,
}: NotesSearchModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { updateNoteMetadata, deleteNote } = useNotesStore();
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;

    const [searchQuery, setSearchQuery] = useState('');
    const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');

    // Filter data based on search query and scope
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const source = searchScope === 'all' ? allFolders : browseFolders;
        return source.filter((f) =>
            !f.isDeleted
            && !f.isSystem
            && f.name.toLowerCase().includes(query));
    }, [allFolders, browseFolders, searchQuery, searchScope]);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const source = searchScope === 'all' ? allNotes : browseNotes;
        return source.filter(
            (n) => !n.isDeleted &&
                n.title.toLowerCase().includes(query) ||
                n.preview.toLowerCase().includes(query)
        );
    }, [allNotes, browseNotes, searchQuery, searchScope]);

    const searchData = useMemo((): ListItem[] => {
        if (!searchQuery.trim()) return [];
        const items: ListItem[] = [];
        if (filteredNotes.length > 0) {
            items.push({ type: 'section-header', title: 'Notes' });
            filteredNotes.forEach((n) => items.push({ type: 'note', data: n }));
        }
        if (filteredFolders.length > 0) {
            items.push({ type: 'section-header', title: 'Folders' });
            filteredFolders.forEach((f) => items.push({ type: 'folder', data: f }));
        }

        return items;
    }, [filteredFolders, filteredNotes, searchQuery]);

    const handleClose = useCallback(() => {
        setSearchQuery('');
        onClose();
    }, [onClose]);

    const handleFolderPress = useCallback(
        (folderId: string) => {
            handleClose();
            onFolderPress(folderId);
        },
        [handleClose, onFolderPress]
    );

    const handleNotePress = useCallback(
        (noteId: string) => {
            handleClose();
            onNotePress(noteId);
        },
        [handleClose, onNotePress]
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

    const handleDeleteNote = useCallback(
        async (id: string) => {
            await deleteNote(id);
        },
        [deleteNote]
    );

    const renderItem = useCallback(
        ({ item, index }: { item: ListItem; index: number }) => {
            if (item.type === 'section-header') {
                const iconName = item.title === 'Folders' ? 'folder' : 'document-text';
                return (
                    <View style={styles.sectionHeaderRow}>
                        <Ionicons name={iconName} size={14} color={colors.text + '50'} />
                        <ThemedText style={[styles.sectionHeaderText, { color: colors.text + '50' }]}>
                            {item.title}
                        </ThemedText>
                    </View>
                );
            }

            if (item.type === 'folder') {
                const isFirstFolder = index === 0 || searchData[index - 1].type !== 'folder';
                const isLastFolder = index === searchData.length - 1 || searchData[index + 1].type !== 'folder';

                return (
                    <FolderCard
                        folder={item.data}
                        onPress={() => handleFolderPress(item.data.id)}
                        onLongPress={onFolderLongPress ? () => onFolderLongPress(item.data) : undefined}
                        swipeable={!item.data.isSystem}
                        isFirst={isFirstFolder}
                        isLast={isLastFolder}
                    />
                );
            }

            if (item.type === 'note') {
                const note = item.data;
                const folder = allFolders.find((f) => f.id === note.folderId);
                const isFirstNote = index === 0 || searchData[index - 1].type !== 'note';
                const isLastNote = index === searchData.length - 1 || searchData[index + 1].type !== 'note';

                const footer = (
                    <View style={styles.noteFooter}>
                        <View style={[styles.folderInfo, { backgroundColor: folder?.color + '10' || colors.background + '10' }]}>
                            <Ionicons
                                name={folder ? (folder.icon as any) : 'home'}
                                size={12}
                                color={folder?.color || colors.text + '80'}
                            />
                            <Text style={[styles.folderName, { color: folder?.color || colors.text + '80' }]}>
                                {folder ? folder.name : 'Notes'}
                            </Text>
                        </View>
                    </View>
                );

                return (
                    <NoteCard
                        note={note}
                        onPress={() => handleNotePress(note.id)}
                        onLongPress={onNoteLongPress ? () => onNoteLongPress(note) : undefined}
                        onDelete={() => handleDeleteNote(note.id)}
                        onTogglePin={() => handleTogglePin(note)}
                        onToggleQuickAccess={() => handleToggleQuickAccess(note)}
                        description={footer}
                        showTimestamp={true}
                        isFirst={isFirstNote}
                        isLast={isLastNote}
                    />
                );
            }

            return null;
        },
        [colors, handleFolderPress, handleNotePress, onFolderLongPress, onNoteLongPress, allFolders, handleDeleteNote, handleTogglePin, handleToggleQuickAccess, searchData]
    );

    const getItemKey = (item: ListItem, index: number): string => {
        if (item.type === 'section-header') return `header-${item.title}`;
        return item.data.id;
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

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
                            placeholder={searchScope === 'all' ? "Search in all folders..." : "Search in this folder..."}
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
                            ]}>All Folders</Text>
                        </Pressable>
                    </View>

                    {/* Search Results List */}
                    {searchQuery.length > 0 && (
                        <FlatList style={{ gap: 8 }}
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
    );
}

const styles = StyleSheet.create({
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
        paddingTop: 4,
        paddingBottom: 10,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
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
    folderInfo: {
        flexDirection: 'row',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
        alignItems: 'center',
        gap: 4,
    },
    folderName: {
        fontSize: 10,
        fontWeight: '600',
    },
    noteFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    preview: {
        flex: 1,
        fontSize: 14,
    },
});
