import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import {
    Folder,
    getFolderById,
    getFoldersInFolder,
    getNotesInFolder,
    Note,
} from '@/dev-data/data';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
}

function FolderCard({ folder, onPress }: FolderItemProps) {
    const { colors, dark } = useTheme();

    return (
        <ThemedPressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.folderCard,
                {
                    borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
                pressed && styles.pressed,
            ]}
        >
            <View style={[styles.folderIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                <Ionicons name="folder" size={22} color="#F59E0B" />
            </View>
            <ThemedText style={styles.folderName}>{folder.name}</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={colors.text + '50'} />
        </ThemedPressable>
    );
}

interface NoteItemProps {
    note: Note;
    onPress: () => void;
}

function NoteCard({ note, onPress }: NoteItemProps) {
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
        <ThemedPressable
            onPress={onPress}
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
    );
}

type ListItem =
    | { type: 'folder'; data: Folder }
    | { type: 'note'; data: Note }
    | { type: 'section-header'; title: string };

export default function NotesList() {
    const router = useRouter();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ folderId?: string }>();

    const currentFolderId = params.folderId ?? null;
    const currentFolder = currentFolderId ? getFolderById(currentFolderId) : null;

    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Get folders and notes for current location
    const folders = useMemo(() => getFoldersInFolder(currentFolderId), [currentFolderId]);
    const notes = useMemo(() => getNotesInFolder(currentFolderId), [currentFolderId]);

    // Filter by search
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return folders;
        const query = searchQuery.toLowerCase();
        return folders.filter((f) => f.name.toLowerCase().includes(query));
    }, [folders, searchQuery]);

    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return notes;
        const query = searchQuery.toLowerCase();
        return notes.filter(
            (n) =>
                n.title.toLowerCase().includes(query) ||
                n.preview.toLowerCase().includes(query)
        );
    }, [notes, searchQuery]);

    // Build list data with section headers
    const listData = useMemo((): ListItem[] => {
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
    }, [filteredFolders, filteredNotes]);

    const handleFolderPress = useCallback(
        (folderId: string) => {
            router.setParams({ folderId });
        },
        [router]
    );

    const handleNotePress = useCallback(
        (noteId: string) => {
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
            return (
                <FolderCard folder={item.data} onPress={() => handleFolderPress(item.data.id)} />
            );
        }

        return <NoteCard note={item.data} onPress={() => handleNotePress(item.data.id)} />;
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
                    headerLeft: currentFolderId
                        ? () => (
                            <Pressable onPress={handleBack} style={styles.headerButton} hitSlop={8}>
                                <Ionicons name="chevron-back" size={26} color={colors.primary} />
                            </Pressable>
                        )
                        : undefined,
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
                data={listData}
                keyExtractor={getItemKey}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons
                            name={searchQuery ? 'search-outline' : 'folder-open-outline'}
                            size={48}
                            color={colors.border}
                        />
                        <Text style={[styles.emptyText, { color: colors.text }]}>
                            {searchQuery ? 'No results found' : 'This folder is empty'}
                        </Text>
                        <Text style={[styles.emptyHint, { color: colors.border }]}>
                            {searchQuery ? 'Try a different search term' : 'Create a note or folder to get started'}
                        </Text>
                    </View>
                }
                renderItem={renderItem}
            />

            {/* Search Modal */}
            <Modal
                visible={isSearchVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsSearchVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setIsSearchVisible(false)}
                >
                    <View
                        style={[
                            styles.searchContainer,
                            {
                                backgroundColor: colors.card,
                                marginTop: insets.top + 12,
                            },
                        ]}
                    >
                        <Pressable onPress={(e) => e.stopPropagation()}>
                            <View style={styles.searchInputWrapper}>
                                <Ionicons
                                    name="search"
                                    size={18}
                                    color={colors.text}
                                    style={styles.searchIcon}
                                />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text }]}
                                    placeholder="Search in this folder..."
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
                        </Pressable>
                        {searchQuery.length > 0 && (
                            <Text style={[styles.searchHint, { color: colors.text }]}>
                                {filteredFolders.length + filteredNotes.length} items found
                            </Text>
                        )}
                    </View>
                </Pressable>
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
    folderName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
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
        marginTop: 8,
        fontSize: 12,
        textAlign: 'center',
    },
});
