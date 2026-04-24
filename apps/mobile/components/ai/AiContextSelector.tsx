import { useNotesStore, TRASH_FOLDER_ID } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

interface AiContextSelectorProps {
    selectedNotes: any[];
    onToggleNote: (note: any) => void;
    onToggleFolder: (folderId: string) => void;
    onClearAll: () => void;
    onClose: () => void;
}

export function AiContextSelector({
    selectedNotes,
    onToggleNote,
    onToggleFolder,
    onClearAll,
    onClose
}: AiContextSelectorProps) {
    const { colors } = useTheme();
    const { notes, folders } = useNotesStore();
    const [search, setSearch] = useState("");

    const filteredNotes = useMemo(() => {
        const activeNotes = notes.filter(n => 
            !n.isDeleted && 
            !n.isPermDeleted && 
            n.folderId !== TRASH_FOLDER_ID
        );
        const searchLower = search.toLowerCase();
        if (!search.trim()) return activeNotes.slice(0, 20);
        return activeNotes.filter(n =>
            (n.title || '').toLowerCase().includes(searchLower)
        ).slice(0, 30);
    }, [notes, search]);

    const filteredFolders = useMemo(() => {
        const activeFolders = folders.filter(f => 
            !f.isDeleted && 
            !f.isPermDeleted && 
            f.id !== TRASH_FOLDER_ID
        );
        const searchLower = search.toLowerCase();
        if (!search.trim()) return activeFolders.slice(0, 10);
        return activeFolders.filter(f =>
            (f.name || '').toLowerCase().includes(searchLower)
        ).slice(0, 20);
    }, [folders, search]);

    const renderFolderItem = ({ item: folder }: { item: any }) => {
        const folderNotes = notes.filter(n => n.folderId === folder.id && !n.isDeleted && !n.isPermDeleted);
        const allSelected = folderNotes.length > 0 && folderNotes.every(fn => selectedNotes.find(pn => pn.id === fn.id));
        const someSelected = folderNotes.some(fn => selectedNotes.find(pn => pn.id === fn.id));

        return (
            <TouchableOpacity
                key={folder.id}
                onPress={() => onToggleFolder(folder.id)}
                style={[
                    styles.itemRow,
                    allSelected && { backgroundColor: colors.primary + '15' }
                ]}
            >
                <Ionicons
                    name={folder.icon || "folder-outline"}
                    size={18}
                    color={folder.color || colors.text + '60'}
                />
                <Text style={[styles.itemText, { color: colors.text }]} numberOfLines={1}>
                    {folder.name}
                </Text>
                {allSelected ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                ) : someSelected ? (
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                ) : null}
            </TouchableOpacity>
        );
    };

    const renderNoteItem = ({ item: note }: { item: any }) => {
        const isSelected = selectedNotes.some(n => n.id === note.id);
        return (
            <TouchableOpacity
                key={note.id}
                onPress={() => onToggleNote(note)}
                style={[
                    styles.itemRow,
                    isSelected && { backgroundColor: colors.primary + '15' }
                ]}
            >
                <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={isSelected ? colors.primary : colors.text + '60'}
                />
                <Text style={[styles.itemText, { color: colors.text }]} numberOfLines={1}>
                    {note.title || "Untitled"}
                </Text>
                {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
        );
    };

    type ContextListItem =
        | { type: 'header'; title: string; count: number }
        | { type: 'section'; title: string; icon: string }
        | { type: 'folder'; data: any }
        | { type: 'note'; data: any };

    const listData: ContextListItem[] = [
        { type: 'header', title: 'Selected', count: selectedNotes.length },
        ...(filteredFolders.length > 0 ? [{ type: 'section', title: 'Folders', icon: 'folder' } as const] : []),
        ...(filteredFolders.map(f => ({ type: 'folder', data: f } as const))),
        ...(filteredNotes.length > 0 ? [{ type: 'section', title: 'Notes', icon: 'document-text' } as const] : []),
        ...(filteredNotes.map(n => ({ type: 'note', data: n } as const)))
    ];

    return (
        <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={[StyleSheet.absoluteFill, styles.overlay]}
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                // keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
                style={{ flex: 1, justifyContent: 'flex-end' }}
            >
                <Animated.View
                    entering={SlideInDown}
                    exiting={SlideOutDown}
                    style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={16} color={colors.text + '40'} style={styles.searchIcon} />
                            <TextInput
                                placeholder="Search notes or folders..."
                                placeholderTextColor={colors.text + '40'}
                                value={search}
                                onChangeText={setSearch}
                                style={[styles.searchInput, { color: colors.text }]}
                            />
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text + '60'} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={listData}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => {
                            switch (item.type) {
                                case 'header':
                                    if (item.count === 0) return null;
                                    return (
                                        <View style={styles.selectedHeader}>
                                            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                                                {item.count} SELECTED
                                            </Text>
                                            <TouchableOpacity onPress={onClearAll}>
                                                <Text style={[styles.clearText, { color: '#EF4444' }]}>Clear all</Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                case 'section':
                                    return (
                                        <View style={styles.sectionHeader}>
                                            <Ionicons name={item.icon as any} size={12} color={colors.text + '40'} />
                                            <Text style={[styles.sectionTitle, { color: colors.text + '40' }]}>
                                                {item.title.toUpperCase()}
                                            </Text>
                                        </View>
                                    );
                                case 'folder':
                                    return renderFolderItem({ item: item.data });
                                case 'note':
                                    return renderNoteItem({ item: item.data });
                                default:
                                    return null;
                            }
                        }}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps="handled"
                    />

                    {selectedNotes.length > 0 && (
                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                                onPress={onClose}
                            >
                                <Text style={styles.confirmButtonText}>
                                    Confirm Selection ({selectedNotes.length})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </KeyboardAvoidingView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        zIndex: 100,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    container: {
        height: '70%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 8,
    },
    closeButton: {
        padding: 4,
    },
    listContent: {
        padding: 12,
        paddingBottom: 40,
    },
    selectedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 16,
        marginBottom: 8,
        paddingHorizontal: 8,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    clearText: {
        fontSize: 12,
        fontWeight: '600',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 12,
        marginBottom: 2,
    },
    itemText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
    },
    confirmButton: {
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    }
});
