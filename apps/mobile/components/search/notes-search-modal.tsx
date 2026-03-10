import FolderCard from '@/components/folders/folder-card';
import NoteCard from '@/components/notes/note-card';
import ThemedText from '@/components/themed-text';
import { Folder, NoteMetadata, useNotesStore, useSearchStore, useSettingsStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ListItem = any;

interface NotesSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onFolderPress: (folderId: string) => void;
    onNotePress: (noteId: string) => void;
    onFolderLongPress?: (folder: Folder) => void;
    onNoteLongPress?: (note: NoteMetadata) => void;
    allFolders: Folder[];
}

export default function NotesSearchModal({
    visible,
    onClose,
    onFolderPress,
    onNotePress,
    onFolderLongPress,
    onNoteLongPress,
    allFolders,
}: NotesSearchModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { updateNoteMetadata, deleteNote, createNote } = useNotesStore();
    const { general } = useSettingsStore();

    const {
        searchQuery,
        isSearching,
        dbResults,
        setSearchQuery,
        resetSearch
    } = useSearchStore();

    // Reset search when opening/closing
    useEffect(() => {
        if (visible) {
            resetSearch();
        }
    }, [visible, resetSearch]);



    const searchData = useMemo(() => {
        if (!searchQuery.trim()) return [];
        return dbResults;
    }, [dbResults, searchQuery]);

    const handleClose = useCallback(() => {
        resetSearch();
        onClose();
    }, [onClose, resetSearch]);

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

    const handleTaskPress = useCallback(
        (taskId: string) => {
            handleClose();
            router.push(`/Tasks/${taskId}`);
        },
        [handleClose, router]
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
                let iconName: any = 'document-text';
                if (item.title === 'Folders') iconName = 'folder';
                if (item.title === 'Tasks') iconName = 'checkbox';
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

            if (item.type === 'task') {
                const task = item.data;
                const folder = allFolders.find((f) => f.id === task.folderId);
                const isFirstTask = index === 0 || searchData[index - 1].type !== 'task';
                const isLastTask = index === searchData.length - 1 || searchData[index + 1].type !== 'task';

                return (
                    <Pressable
                        onPress={() => handleTaskPress(task.id)}
                        style={({ pressed }) => [
                            styles.taskCard,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            isFirstTask && styles.roundTop,
                            isLastTask && styles.roundBottom,
                            pressed && { backgroundColor: colors.border + '50' }
                        ]}
                    >
                        <View style={styles.taskIconWrapper}>
                            <Ionicons
                                name={task.completed ? "checkmark-circle" : "checkbox-outline"}
                                size={20}
                                color={task.completed ? "#10b981" : colors.primary}
                            />
                        </View>
                        <View style={styles.taskContent}>
                            <Text style={[
                                styles.taskTitle,
                                { color: colors.text },
                                task.completed && styles.taskCompleted
                            ]}>
                                {task.title}
                            </Text>
                            <View style={styles.taskFooter}>
                                <View style={[styles.folderInfo, { backgroundColor: folder?.color + '10' || colors.background + '10' }]}>
                                    <Ionicons
                                        name={folder ? (folder.icon as any) : 'home'}
                                        size={10}
                                        color={folder?.color || colors.text + '80'}
                                    />
                                    <Text style={[styles.folderName, { color: folder?.color || colors.text + '80' }]}>
                                        {folder ? folder.name : 'Notes'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </Pressable>
                );
            }

            if (item.type === 'action') {
                const action = item;
                const isFirstAction = index === 0 || searchData[index - 1].type !== 'action';
                const isLastAction = index === searchData.length - 1 || searchData[index + 1].type !== 'action';

                return (
                    <Pressable
                        onPress={async () => {
                            handleClose();
                            if (action.actionType === 'create_note') {
                                const newNote = await createNote({ folderId: action.folderId });
                                router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'new' } });
                            } else if (action.actionType === 'create_task') {
                                router.push({ pathname: '/Tasks/new', params: { folderId: action.folderId } });
                            }
                        }}
                        style={({ pressed }) => [
                            styles.taskCard,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            isFirstAction && styles.roundTop,
                            isLastAction && styles.roundBottom,
                            pressed && { backgroundColor: colors.border + '50' }
                        ]}
                    >
                        <View style={styles.taskIconWrapper}>
                            <Ionicons
                                name={action.actionType === 'create_note' ? "document-text-outline" : "checkbox-outline"}
                                size={20}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.taskContent}>
                            <Text style={[
                                styles.taskTitle,
                                { color: colors.text }
                            ]}>
                                {action.title}
                            </Text>
                        </View>
                    </Pressable>
                );
            }

            return null;
        },
        [colors, handleFolderPress, handleNotePress, handleTaskPress, onFolderLongPress, onNoteLongPress, allFolders, handleDeleteNote, handleTogglePin, handleToggleQuickAccess, searchData, createNote, router, handleClose]
    );

    const getItemKey = (item: any, index: number): string => {
        if (item.type === 'section-header') return `header-${item.title}`;
        return item.id;
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
                        {isSearching ? (
                            <ActivityIndicator size="small" color={colors.primary} style={styles.searchIcon} />
                        ) : (
                            <Ionicons
                                name="search"
                                size={18}
                                color={colors.text}
                                style={styles.searchIcon}
                            />
                        )}
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search in all folders..."
                            placeholderTextColor={'#888'}
                            value={searchQuery}
                            onChangeText={(text) => setSearchQuery(text, null)}
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('', null)}>
                                <Ionicons name="close-circle" size={18} color={colors.text} />
                            </Pressable>
                        )}
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
                                !isSearching ? (
                                    <Text style={[styles.searchHint, { color: colors.text }]}>
                                        No results found
                                    </Text>
                                ) : null
                            }
                        />
                    )}

                    {!searchQuery && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="sparkles-outline" size={40} color={colors.primary} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <Text style={[styles.emptyText, { color: colors.text, opacity: 0.4 }]}>
                                Search Notes, Tasks & Folders
                            </Text>
                        </View>
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
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
        paddingBottom: 8,
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
        marginTop: 40,
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.6,
    },
    searchListContent: {
        paddingTop: 4,
        paddingBottom: 20,
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
    taskCard: {
        flexDirection: 'row',
        padding: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: -StyleSheet.hairlineWidth,
        alignItems: 'center',
        gap: 12,
    },
    roundTop: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    roundBottom: {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        marginBottom: 0,
    },
    taskIconWrapper: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskContent: {
        flex: 1,
        gap: 4,
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    taskCompleted: {
        textDecorationLine: 'line-through',
        opacity: 0.5,
    },
    taskFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 13,
        fontWeight: '600',
    }
});
