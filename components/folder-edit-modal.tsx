import { COLOR_PALETTE } from '@/constants/colors';
import { useAppTheme } from '@/hooks/use-app-theme';
import { TRASH_FOLDER_ID, useNotesStore, type Folder } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PlatformPressable } from '@react-navigation/elements';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationPickerModal from './location-picker-modal';

// Available folder icons
const FOLDER_ICONS = [
    'folder', 'briefcase', 'person', 'people',
    'home', 'star', 'heart', 'bookmark', 'flag',
    'calendar', 'time', 'alarm', 'notifications', 'mail',
    'document', 'documents', 'archive', 'file-tray',
    'book', 'library', 'school', 'code', 'terminal',
    'globe', 'earth', 'cloud', 'server', 'git-branch',
    'camera', 'image', 'images', 'film', 'musical-notes',
    'cart', 'card', 'cash', 'wallet', 'gift',
    'airplane', 'car', 'bicycle', 'train', 'boat',
    'fitness', 'medical', 'nutrition', 'restaurant', 'cafe',
    'analytics', 'attach', 'bar-chart', 'basket', 'build',
    'chatbox', 'construct', 'cube', 'diamond', 'flask',
    'game-controller', 'hammer', 'key', 'leaf', 'mic',
    'paw', 'pencil', 'planet', 'rocket',
    'shirt', 'trophy', 'umbrella', 'videocam', 'wine',
    'bulb', 'color-palette', 'compass', 'cut',
    'flash', 'glasses', 'ice-cream', 'magnet', 'map',
    'pint', 'podium', 'ribbon', 'skull', 'speedometer',
    'thermometer', 'thunderstorm', 'watch', 'water'
];

// Available folder colors


interface FolderEditModalProps {
    visible: boolean;
    folder: Folder | null; // null = create mode
    defaultParentId?: string | null; // For create mode - default location
    onClose: () => void;
}

export default function FolderEditModal({
    visible,
    folder,
    defaultParentId = null,
    onClose,
}: FolderEditModalProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { folders, createFolder, updateFolder, getFolderById } = useNotesStore();

    const isCreateMode = folder === null;

    const [name, setName] = useState('');
    const [icon, setIcon] = useState('folder');
    const [color, setColor] = useState(COLOR_PALETTE[0].value); // Default amber color
    const [parentId, setParentId] = useState<string | null>(null);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // Reset state when folder changes or modal opens
    useEffect(() => {
        if (visible) {
            if (folder) {
                // Edit mode
                setName(folder.name);
                setIcon(folder.icon);
                setColor(folder.color || COLOR_PALETTE[0].value);
                setParentId(folder.parentId);
            } else {
                // Create mode
                setName('');
                setIcon('folder');
                setColor(COLOR_PALETTE[0].value);
                setParentId(defaultParentId);
            }
        }
    }, [folder, visible, defaultParentId]);

    // Get all descendant folder IDs (to exclude from parent selection)
    const getDescendantIds = useCallback((folderId: string): string[] => {
        const children = folders.filter(f => f.parentId === folderId && !f.isDeleted);
        return [folderId, ...children.flatMap(c => getDescendantIds(c.id))];
    }, [folders]);

    // Available parent folders (excludes current folder, descendants, trash, and deleted)
    const availableParentFolders = useMemo(() => {
        if (isCreateMode) {
            // In create mode, show all non-deleted, non-system folders
            return folders.filter(f =>
                f.id !== TRASH_FOLDER_ID &&
                !f.isDeleted &&
                !f.isSystem
            );
        }
        // In edit mode, exclude current folder and its descendants
        const excludedIds = getDescendantIds(folder!.id);
        return folders.filter(f =>
            !excludedIds.includes(f.id) &&
            f.id !== TRASH_FOLDER_ID &&
            !f.isDeleted
        );
    }, [folder, folders, getDescendantIds, isCreateMode]);

    // Get parent folder name for display
    const getParentName = useCallback((id: string | null) => {
        if (id === null) return 'Notes (Root)';
        const parent = getFolderById(id);
        return parent?.name ?? 'Unknown';
    }, [getFolderById]);

    // Build breadcrumb path for a folder
    const getFolderPath = useCallback((folderId: string | null): string => {
        if (folderId === null) return 'Notes';
        const path: string[] = [];
        let currentId: string | null = folderId;
        while (currentId) {
            const f = getFolderById(currentId);
            if (f) {
                path.unshift(f.name);
                currentId = f.parentId;
            } else {
                break;
            }
        }
        return ['Notes', ...path].join(' / ');
    }, [getFolderById]);

    const handleSave = () => {
        if (!name.trim()) return;

        if (isCreateMode) {
            // Create new folder with selected icon and color
            createFolder({ parentId, name: name.trim(), icon, color });
        } else {
            // Update existing folder
            updateFolder(folder!.id, {
                name: name.trim(),
                icon,
                color,
                parentId,
            });
        }
        onClose();
    };

    const handleClose = () => {
        setShowLocationPicker(false);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                    <PlatformPressable onPress={handleClose} style={[styles.headerButton]}>
                        <Text style={[styles.headerButtonCancelText, { color: colors.primary }]}>Cancel</Text>
                    </PlatformPressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        {isCreateMode ? 'New Folder' : 'Edit Folder'}
                    </Text>
                    <PlatformPressable
                        onPress={handleSave}
                        style={styles.headerButton}
                        disabled={!name.trim()}
                    >
                        <Text style={[
                            styles.headerButtonSaveText,
                            { color: !name.trim() ? colors.border : colors.primary }
                        ]}>{isCreateMode ? 'Create' : 'Save'}</Text>
                    </PlatformPressable>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                >
                    {/* Folder Name */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Name</Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: colors.card,
                                    color: colors.text,
                                    borderColor: colors.border,
                                }
                            ]}
                            value={name}
                            onChangeText={setName}
                            placeholder="Folder name"
                            placeholderTextColor={colors.text + '50'}
                        />
                    </View>

                    {/* Folder Location */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
                        <Pressable
                            onPress={() => setShowLocationPicker(true)}
                            style={[
                                styles.locationButton,
                                {
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                }
                            ]}
                        >
                            <View style={styles.locationContent}>
                                <Ionicons name="folder" size={20} color={folder?.color || colors.primary} />
                                <Text style={[styles.locationText, { color: colors.text }]}>
                                    {getParentName(parentId)}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.text + '50'} />
                        </Pressable>
                    </View>

                    {/* Folder Icon */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Icon</Text>
                        <View style={[styles.iconScrollContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <ScrollView
                                style={styles.iconScroll}
                                contentContainerStyle={styles.iconGrid}
                                nestedScrollEnabled={true}
                                showsVerticalScrollIndicator={true}
                            >
                                {FOLDER_ICONS.map((iconName) => (
                                    <Pressable
                                        key={iconName}
                                        onPress={() => setIcon(iconName)}
                                        style={[
                                            styles.iconButton,
                                            icon === iconName && { backgroundColor: color + '20' }
                                        ]}
                                    >
                                        <Ionicons
                                            name={iconName as keyof typeof Ionicons.glyphMap}
                                            size={24}
                                            color={icon === iconName ? color || folder?.color || colors.primary : colors.text + '80'}
                                        />
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    {/* Folder Color */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Color</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={[styles.colorScroll, { backgroundColor: colors.card, borderColor: colors.border }]}
                            contentContainerStyle={styles.colorScrollContent}
                        >
                            {COLOR_PALETTE.map((colorOption) => {
                                const colorValue = colorOption.value;
                                return (
                                    <Pressable
                                        key={colorValue}
                                        onPress={() => setColor(colorValue)}
                                        style={[
                                            styles.colorButton,
                                            { backgroundColor: colorValue },
                                            color === colorValue && {
                                                borderWidth: 3,
                                                borderColor: colors.primary,
                                            }
                                        ]}
                                    >
                                        {color === colorValue && (
                                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </ScrollView>

                {/* Location Picker Modal */}
                <LocationPickerModal
                    visible={showLocationPicker}
                    currentFolderId={folder?.id}
                    selectedParentId={parentId}
                    onSelect={(newParentId) => {
                        setParentId(newParentId);
                        setShowLocationPicker(false);
                    }}
                    onClose={() => setShowLocationPicker(false)}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerButton: {
        minWidth: 60,
        paddingVertical: 8,
        justifyContent: 'center',
    },
    headerButtonCancelText: {
        fontSize: Platform.OS === 'ios' ? 17 : 14,
        fontWeight: '400',
    },
    headerButtonSaveText: {
        fontSize: Platform.OS === 'ios' ? 17 : 14,
        fontWeight: Platform.OS === 'ios' ? '600' : '700',
        textTransform: Platform.OS === 'android' ? 'uppercase' : 'none',
    },
    headerTitle: {
        fontSize: Platform.OS === 'ios' ? 17 : 20,
        fontWeight: Platform.OS === 'ios' ? '600' : '500',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.7,
    },
    textInput: {
        fontSize: 16,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    iconScrollContainer: {
        maxHeight: 220,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    iconScroll: {
        flex: 0,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 8,
        justifyContent: 'center',
    },
    iconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    colorScroll: {
        borderRadius: 12,
        borderWidth: 1,
    },
    colorScrollContent: {
        padding: 12,
        gap: 12,
        flexDirection: 'row',
    },
    colorButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    locationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    locationText: {
        fontSize: 16,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        gap: 12,
    },
    locationItemContent: {
        flex: 1,
    },
    locationItemName: {
        fontSize: 16,
        fontWeight: '500',
    },
    locationItemPath: {
        fontSize: 12,
        marginTop: 2,
    },
    folderIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
