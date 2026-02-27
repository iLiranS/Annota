import { TRASH_FOLDER_ID, useNotesStore } from '@/lib/stores/notes.store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LocationPickerModalProps {
    visible: boolean;
    currentFolderId?: string; // The folder being moved (to exclude it and children)
    selectedParentId: string | null;
    onSelect: (parentId: string | null) => void;
    onClose: () => void;
}

/**
 * Navigable folder picker modal
 * Allows browsing folder hierarchy to select a destination
 */
export default function LocationPickerModal({
    visible,
    currentFolderId,
    selectedParentId,
    onSelect,
    onClose,
}: LocationPickerModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { folders, getFolderById } = useNotesStore();

    // Current browsing location (not the selected destination)
    const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);

    // Reset browsing position when modal opens
    React.useEffect(() => {
        if (visible) {
            setBrowsingFolderId(selectedParentId);
        }
    }, [visible, selectedParentId]);

    // Get all descendant folder IDs (to exclude from selection)
    const getDescendantIds = useCallback((folderId: string): string[] => {
        const children = folders.filter(f => f.parentId === folderId && !f.isDeleted);
        return [folderId, ...children.flatMap(c => getDescendantIds(c.id))];
    }, [folders]);

    // IDs that should be excluded (current folder and its descendants)
    const excludedIds = useMemo(() => {
        if (!currentFolderId) return new Set<string>();
        return new Set(getDescendantIds(currentFolderId));
    }, [currentFolderId, getDescendantIds]);

    // Folders at current browsing level
    const foldersAtLevel = useMemo(() => {
        return folders.filter(f =>
            f.parentId === browsingFolderId &&
            f.id !== TRASH_FOLDER_ID &&
            !f.isDeleted &&
            !f.isSystem &&
            !excludedIds.has(f.id)
        );
    }, [folders, browsingFolderId, excludedIds]);

    // Current browsing folder object
    const browsingFolder = browsingFolderId ? getFolderById(browsingFolderId) : null;

    // Build breadcrumb path
    const breadcrumbs = useMemo(() => {
        const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Notes' }];
        let currentId = browsingFolderId;
        const path: { id: string; name: string }[] = [];

        while (currentId) {
            const folder = getFolderById(currentId);
            if (folder) {
                path.unshift({ id: folder.id, name: folder.name });
                currentId = folder.parentId;
            } else {
                break;
            }
        }

        return [...crumbs, ...path];
    }, [browsingFolderId, getFolderById]);

    // Check if current browsing location is selected
    const isCurrentLocationSelected = browsingFolderId === selectedParentId;

    // Handle selecting current location
    const handleSelectHere = () => {
        onSelect(browsingFolderId);
    };

    // Handle navigating into a folder
    const handleNavigateInto = (folderId: string) => {
        setBrowsingFolderId(folderId);
    };

    // Handle navigating back
    const handleNavigateBack = () => {
        if (browsingFolder) {
            setBrowsingFolderId(browsingFolder.parentId);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose} style={styles.headerButton}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Select Location
                    </Text>
                    <View style={styles.headerButton} />
                </View>

                {/* Breadcrumb Navigation */}
                <View style={[styles.breadcrumbContainer, { borderBottomColor: colors.border }]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.breadcrumbContent}
                    >
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb.id ?? 'root'}>
                                {index > 0 && (
                                    <Ionicons
                                        name="chevron-forward"
                                        size={14}
                                        color={colors.text + '40'}
                                        style={styles.breadcrumbSeparator}
                                    />
                                )}
                                <Pressable
                                    onPress={() => setBrowsingFolderId(crumb.id)}
                                    style={[
                                        styles.breadcrumbItem,
                                        index === breadcrumbs.length - 1 && styles.breadcrumbItemActive
                                    ]}
                                >
                                    <Text style={[
                                        styles.breadcrumbText,
                                        { color: index === breadcrumbs.length - 1 ? colors.primary : colors.text + '80' }
                                    ]}>
                                        {crumb.name}
                                    </Text>
                                </Pressable>
                            </React.Fragment>
                        ))}
                    </ScrollView>
                </View>

                {/* Current Location Info & Select Button */}
                <View style={[styles.currentLocationBar, { backgroundColor: colors.card }]}>
                    <View style={styles.currentLocationInfo}>
                        <Ionicons
                            name={browsingFolder?.icon as keyof typeof Ionicons.glyphMap ?? 'home'}
                            size={20}
                            color={colors.primary}
                        />
                        <Text style={[styles.currentLocationText, { color: colors.text }]}>
                            {browsingFolder?.name ?? 'Notes (Root)'}
                        </Text>
                        {isCurrentLocationSelected && (
                            <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.selectedBadgeText}>Current</Text>
                            </View>
                        )}
                    </View>
                    <Pressable
                        onPress={handleSelectHere}
                        style={[
                            styles.selectButton,
                            { backgroundColor: colors.primary }
                        ]}
                    >
                        <Text style={styles.selectButtonText}>
                            {isCurrentLocationSelected ? 'Keep Here' : 'Move Here'}
                        </Text>
                    </Pressable>
                </View>

                {/* Folder List */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                >
                    {/* Back button when not at root */}
                    {browsingFolderId !== null && (
                        <Pressable
                            onPress={handleNavigateBack}
                            style={[styles.folderItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                            <View style={[styles.folderIconWrapper, { backgroundColor: colors.primary + '10' }]}>
                                <Ionicons name="arrow-back" size={20} color={colors.text + '80'} />
                            </View>
                            <Text style={[styles.folderName, { color: colors.text + '80' }]}>
                                Back to {browsingFolder?.parentId ? getFolderById(browsingFolder.parentId)?.name : 'Notes'}
                            </Text>
                        </Pressable>
                    )}

                    {/* Empty state */}
                    {foldersAtLevel.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={48} color={colors.border} />
                            <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                                No subfolders here
                            </Text>
                            <Text style={[styles.emptyHint, { color: colors.text + '40' }]}>
                                You can still select this location
                            </Text>
                        </View>
                    )}

                    {/* Folders at current level */}
                    {foldersAtLevel.map((folder) => {
                        const hasChildren = folders.some(f =>
                            f.parentId === folder.id &&
                            !f.isDeleted &&
                            !excludedIds.has(f.id)
                        );

                        return (
                            <Pressable
                                key={folder.id}
                                onPress={() => handleNavigateInto(folder.id)}
                                style={[
                                    styles.folderItem,
                                    {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border
                                    }
                                ]}
                            >
                                <View style={[styles.folderIconWrapper, { backgroundColor: '#F59E0B' + '20' }]}>
                                    <Ionicons
                                        name={folder.icon as keyof typeof Ionicons.glyphMap}
                                        size={20}
                                        color="#F59E0B"
                                    />
                                </View>
                                <Text style={[styles.folderName, { color: colors.text }]}>
                                    {folder.name}
                                </Text>
                                {hasChildren && (
                                    <Ionicons name="chevron-forward" size={20} color={colors.text + '40'} />
                                )}
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
        minWidth: 40,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    breadcrumbContainer: {
        borderBottomWidth: 1,
        paddingVertical: 10,
    },
    breadcrumbContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    breadcrumbItem: {
        paddingVertical: 4,
        paddingHorizontal: 2,
    },
    breadcrumbItemActive: {
        // Active state handled by color
    },
    breadcrumbText: {
        fontSize: 14,
    },
    breadcrumbSeparator: {
        marginHorizontal: 4,
    },
    currentLocationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        gap: 12,
    },
    currentLocationInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    currentLocationText: {
        fontSize: 15,
        fontWeight: '500',
    },
    selectedBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    selectedBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    selectButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    selectButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    folderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        gap: 12,
    },
    folderIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    folderName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
    },
    emptyHint: {
        fontSize: 13,
        marginTop: 4,
    },
});
