import FolderCard from '@/components/folders/folder-card';
import NoteCard from '@/components/notes/note-card';
import ThemedText from '@/components/themed-text';
import { Folder, NoteMetadata } from '@/stores/notes-store';
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
    onDeleteFolder: (folderId: string) => void;
    onDeleteNote: (noteId: string) => void;
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
    onDeleteFolder,
    onDeleteNote,
    onFolderLongPress,
    onNoteLongPress,
    allFolders,
    allNotes,
    browseFolders,
    browseNotes,
}: NotesSearchModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');

    // Filter data based on search query and scope
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const source = searchScope === 'all' ? allFolders : browseFolders;
        return source.filter((f) => f.name.toLowerCase().includes(query));
    }, [allFolders, browseFolders, searchQuery, searchScope]);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        const source = searchScope === 'all' ? allNotes : browseNotes;
        return source.filter(
            (n) =>
                n.title.toLowerCase().includes(query) ||
                n.preview.toLowerCase().includes(query)
        );
    }, [allNotes, browseNotes, searchQuery, searchScope]);

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

    const renderItem = useCallback(
        ({ item }: { item: ListItem }) => {
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
                        onLongPress={onFolderLongPress ? () => onFolderLongPress(item.data) : undefined}
                        onDelete={() => onDeleteFolder(item.data.id)}
                        swipeable={!item.data.isSystem}
                    />
                );
            }

            return (
                <NoteCard
                    note={item.data}
                    onPress={() => handleNotePress(item.data.id)}
                    onLongPress={onNoteLongPress ? () => onNoteLongPress(item.data) : undefined}
                    onDelete={() => onDeleteNote(item.data.id)}
                />
            );
        },
        [colors, handleFolderPress, handleNotePress, onDeleteFolder, onDeleteNote, onFolderLongPress, onNoteLongPress]
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
        paddingTop: 8,
        paddingBottom: 20,
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
});
