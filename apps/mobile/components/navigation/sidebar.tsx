import { useAppTheme } from '@/hooks/use-app-theme';
import type { Tag } from '@annota/core';
import { DAILY_NOTES_FOLDER_ID, useUserStore as useAuthStore, useNotesStore, useSyncStore, type Folder } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
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
import FolderEditModal from '../folder-edit-modal';
import TagEditModal from '../tag-edit-modal';
import { DailyNoteIcon } from '../ui/daily-note-icon';
import { HapticPressable } from '../ui/haptic-pressable';



interface SidebarItemProps {
    icon?: keyof typeof Ionicons.glyphMap;
    renderIcon?: () => React.ReactNode;
    label: string;
    onPress: () => void;
    onLongPress?: () => void;
    iconColor?: string;
    isActive?: boolean;
}

function SidebarItem({ icon, renderIcon, label, onPress, onLongPress, iconColor, isActive }: SidebarItemProps) {
    const { colors } = useAppTheme();

    return (
        <Animated.View layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}>
            <HapticPressable
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                    styles.sidebarItem,
                    isActive && { backgroundColor: colors.primary + '15' },
                    pressed && { opacity: 0.7 },
                ]}
            >
                {renderIcon ? (
                    renderIcon()
                ) : (
                    <Ionicons
                        name={icon!}
                        size={22}
                        color={iconColor || (isActive ? colors.primary : colors.text)}
                    />
                )}
                <Text style={[
                    styles.sidebarItemText,
                    { color: isActive ? colors.primary : colors.text }
                ]}>
                    {label}
                </Text>
            </HapticPressable>
        </Animated.View>
    );
}

interface FolderTreeItemProps {
    folder: Folder;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggle: () => void;
    onNavigate: () => void;
    onLongPress: () => void;
    renderChildren: () => React.ReactNode;
}

function FolderTreeItem({
    folder,
    depth,
    isExpanded,
    hasChildren,
    onToggle,
    onNavigate,
    onLongPress,
    renderChildren,
}: FolderTreeItemProps) {
    const { colors } = useAppTheme();

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: withTiming(isExpanded ? '90deg' : '0deg', { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) }) }]
    }));

    return (
        <Animated.View
            layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}
            style={{ overflow: 'hidden' }}
        >
            <Pressable
                onPress={hasChildren ? onToggle : undefined}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                    styles.folderRow,
                    { paddingLeft: 12 + depth * 14 },
                    // Removed hover effect for toggle row per request
                ]}
            >
                <Pressable
                    onPress={onNavigate}
                    onLongPress={onLongPress}
                    style={({ pressed }) => [
                        styles.folderItemButton,
                        pressed && { opacity: 0.7 },
                    ]}
                >
                    <View style={[styles.folderIconWrapper, { backgroundColor: folder.color + '20' }]}>
                        <Ionicons
                            name={(folder.icon as keyof typeof Ionicons.glyphMap) || 'folder'}
                            size={16}
                            color={folder.color}
                        />
                    </View>
                    <Text style={[styles.folderItemText, { color: colors.text }]} numberOfLines={1}>
                        {folder.name}
                    </Text>
                </Pressable>

                {hasChildren ? (
                    <Animated.View style={[styles.folderToggle, chevronStyle]}>
                        <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.text}
                        />
                    </Animated.View>
                ) : (
                    <View style={styles.folderTogglePlaceholder} />
                )}
            </Pressable>

            {hasChildren && isExpanded ? (
                <Animated.View
                    entering={FadeIn.duration(250)}
                    exiting={FadeOut.duration(200)}
                    layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                >
                    {renderChildren()}
                </Animated.View>
            ) : null}

        </Animated.View>
    );
}

function Separator() {
    const { colors } = useAppTheme();
    return (
        <Animated.View
            layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}
            style={[styles.separator, { backgroundColor: colors.border }]}
        />
    );
}

interface SidebarProps {
    onNavigate?: () => void;
}

export default function Sidebar({ onNavigate, ...props }: SidebarProps & React.ComponentProps<typeof ScrollView>) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const folders = useNotesStore(s => s.folders);
    const notes = useNotesStore(s => s.notes);
    const tags = useNotesStore(s => s.tags);
    const getFoldersInFolder = useNotesStore(s => s.getFoldersInFolder);
    const rootSortType = useNotesStore(s => s.rootSettings.sortType);
    const segments = useSegments();
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [isQuickAccessExpanded, setIsQuickAccessExpanded] = useState(false);
    const [isTagsExpanded, setIsTagsExpanded] = useState(true);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);

    // Offline / sync state
    const isOnline = useSyncStore(s => s.isOnline);
    const isGuest = useAuthStore(s => s.isGuest);
    const [retryCooldown, setRetryCooldown] = useState(false);
    const showOfflineBanner = !isOnline && !isGuest;

    const quickAccessChevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: withTiming(isQuickAccessExpanded ? '90deg' : '0deg', { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) }) }]
    }));

    const tagsChevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: withTiming(isTagsExpanded ? '90deg' : '0deg', { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) }) }]
    }));

    const handleRetry = useCallback(() => {
        if (retryCooldown) return;
        setRetryCooldown(true);
        useSyncStore.getState().forceSync().catch(console.error);
        setTimeout(() => setRetryCooldown(false), 10_000);
    }, [retryCooldown]);

    useEffect(() => {
        const load = async () => {
            try {
                const [tags, quickAccess, foldersSaved] = await Promise.all([
                    AsyncStorage.getItem('sidebar_tags_expanded'),
                    AsyncStorage.getItem('sidebar_quick_access_expanded'),
                    AsyncStorage.getItem('sidebar_expanded_folders')
                ]);

                if (tags !== null) setIsTagsExpanded(tags === 'true');
                if (quickAccess !== null) setIsQuickAccessExpanded(quickAccess === 'true');
                if (foldersSaved !== null) setExpandedFolders(new Set(JSON.parse(foldersSaved)));
            } catch (error) {
                console.warn('[Sidebar] Failed to load expanded states:', error);
            }
        };
        load();
    }, []);

    const toggleTagsExpanded = useCallback(() => {
        setIsTagsExpanded(prev => {
            const next = !prev;
            AsyncStorage.setItem('sidebar_tags_expanded', String(next)).catch(console.error);
            return next;
        });
    }, []);

    const toggleQuickAccessExpanded = useCallback(() => {
        setIsQuickAccessExpanded(prev => {
            const next = !prev;
            AsyncStorage.setItem('sidebar_quick_access_expanded', String(next)).catch(console.error);
            return next;
        });
    }, []);

    const toggleFolderExpanded = useCallback((folderId: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            AsyncStorage.setItem('sidebar_expanded_folders', JSON.stringify(Array.from(next))).catch(console.error);
            return next;
        });
    }, []);

    // Get non-system top-level folders
    const topLevelFolders = useMemo(() => {
        const { sortFolders } = require('@annota/core');
        const filtered = folders.filter(f => (f.parentId ?? null) === null && !f.isSystem && !f.isDeleted);
        // We use rootSortType here for the top level sorting
        const sorted = sortFolders(filtered, rootSortType || 'UPDATED_LAST');
        return sorted;
    }, [folders, rootSortType]);

    useEffect(() => {
        if (folders.length > 0) {
            console.log(`[Sidebar] folders store has ${folders.length} items.`);
        }
    }, [folders.length]);

    // Get Filtered Quick Access Notes
    const quickAccessNotes = useMemo(() => {
        return notes.filter(n => n.isQuickAccess && !n.isDeleted);
    }, [notes]);

    const closeDrawer = () => {
        onNavigate?.();
    };

    const navigateToNotes = (folderId?: string) => {
        closeDrawer();
        const isInNotes = segments[0] === 'Notes';

        if (folderId) {
            // If already in Notes browsing, push so back works folder->folder
            // If switching from another context, replace stack
            if (isInNotes) {
                router.push({ pathname: '/Notes', params: { folderId } });
            } else {
                router.replace({ pathname: '/Notes', params: { folderId } });
            }
        } else {
            router.replace('/Notes');
        }
    };

    const navigateToDailyNotes = () => {
        navigateToNotes(DAILY_NOTES_FOLDER_ID);
    };

    const navigateToTag = (tagId: string) => {
        closeDrawer();
        const isInNotes = segments[0] === 'Notes';

        if (isInNotes) {
            router.push({ pathname: '/Notes', params: { tagId } });
        } else {
            router.replace({ pathname: '/Notes', params: { tagId } });
        }
    };


    const navigateToTrash = () => {
        closeDrawer();
        router.replace('/Notes/trash');
    };

    const navigateToHome = () => {
        closeDrawer();
        // Use replace to avoid building up a stack of category screens
        router.replace('/');
    };

    const navigateToSettings = () => {
        closeDrawer();
        router.push('/settings');
    };

    const toggleFolder = toggleFolderExpanded;

    const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode => {
        const children = getFoldersInFolder(parentId).filter(f => !f.isSystem);
        if (children.length === 0) return null;

        return (
            <View>
                {children.map((folder) => {
                    const nested = getFoldersInFolder(folder.id).filter(f => !f.isSystem);
                    const hasChildren = nested.length > 0;
                    const isExpanded = expandedFolders.has(folder.id);

                    return (
                        <FolderTreeItem
                            key={folder.id}
                            folder={folder}
                            depth={depth}
                            isExpanded={isExpanded}
                            hasChildren={hasChildren}
                            onToggle={() => toggleFolder(folder.id)}
                            onNavigate={() => navigateToNotes(folder.id)}
                            onLongPress={() => setEditingFolder(folder)}
                            renderChildren={() => renderFolderTree(folder.id, depth + 1)}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                {...props}
                contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingTop: insets.top + 16 }]}
            >
                <View style={{ flex: 1 }}>
                    {/* Top Section */}
                    <View style={styles.section}>
                        <SidebarItem
                            icon="home"
                            label="Home"
                            onPress={navigateToHome}
                            iconColor={'#6366F1'}
                        />


                        <SidebarItem
                            renderIcon={() => (
                                <DailyNoteIcon
                                    size={22}
                                    color={folders.find(f => f.id === DAILY_NOTES_FOLDER_ID)?.color || '#8B5CF6'}
                                />
                            )}
                            label={"Daily Notes"}
                            onPress={navigateToDailyNotes}
                            onLongPress={() => {
                                const dailyFolder = folders.find(f => f.id === DAILY_NOTES_FOLDER_ID);
                                if (dailyFolder) setEditingFolder(dailyFolder);
                            }}
                        />

                        <Animated.View layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}>
                            <Pressable
                                onPress={toggleQuickAccessExpanded}
                                style={[
                                    styles.sidebarItem,
                                    // Removed hover effect for toggle row per request
                                ]}
                            >
                                <Ionicons
                                    name={'star'}
                                    size={22}
                                    color={"#FBBF24"}
                                />
                                <Text style={[
                                    styles.sidebarItemText,
                                    { color: colors.text, flex: 1 }
                                ]}>
                                    Quick Access
                                </Text>
                                <Animated.View style={quickAccessChevronStyle}>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color={colors.text}
                                    />
                                </Animated.View>
                            </Pressable>
                        </Animated.View>

                        {/* Quick Access List */}
                        {isQuickAccessExpanded && (
                            <Animated.View
                                entering={FadeIn.duration(250)}
                                exiting={FadeOut.duration(200)}
                                layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                                style={[styles.quickAccessList, { overflow: 'hidden' }]}
                            >
                                {quickAccessNotes.length === 0 ? (
                                    <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
                                        No starred notes
                                    </Text>
                                ) : (
                                    quickAccessNotes.map(note => (
                                        <HapticPressable
                                            key={note.id}
                                            onPress={() => {
                                                closeDrawer();
                                                router.push({ pathname: '/Notes/[id]', params: { id: note.id } });
                                            }}
                                            style={({ pressed }) => [
                                                styles.quickAccessItem,
                                                pressed && { opacity: 0.7 }
                                            ]}
                                        >
                                            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                                            <Text style={[styles.quickAccessText, { color: colors.text }]} numberOfLines={1}>
                                                {note.title || 'Untitled Note'}
                                            </Text>
                                        </HapticPressable>
                                    ))
                                )}
                            </Animated.View>
                        )}


                    </View>

                    <Separator />

                    {/* Middle Section: All Notes & Folders */}
                    <View style={styles.section}>
                        <SidebarItem
                            icon="documents"
                            label="All Notes"
                            iconColor={colors.primary}
                            onPress={() => navigateToNotes()}
                        />
                        <View style={styles.folderContainer}>
                            {topLevelFolders.map((folder: any) => {
                                const nested = getFoldersInFolder(folder.id).filter(f => !f.isSystem);
                                const hasChildren = nested.length > 0;
                                const isExpanded = expandedFolders.has(folder.id);

                                return (
                                    <FolderTreeItem
                                        key={folder.id}
                                        folder={folder}
                                        depth={0}
                                        isExpanded={isExpanded}
                                        hasChildren={hasChildren}
                                        onToggle={() => toggleFolder(folder.id)}
                                        onNavigate={() => navigateToNotes(folder.id)}
                                        onLongPress={() => setEditingFolder(folder)}
                                        renderChildren={() => renderFolderTree(folder.id, 1)}
                                    />
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Tags Section */}
                <View style={styles.section}>

                    {/* Tags Toggle */}
                    <Animated.View layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}>
                        <Pressable
                            onPress={toggleTagsExpanded}
                            style={[
                                styles.sidebarItem,
                            ]}
                        >
                            <Ionicons
                                name={'pricetag'}
                                size={22}
                                color={colors.primary} // Pink 500
                            />
                            <Text style={[
                                styles.sidebarItemText,
                                { color: colors.text, flex: 1 }
                            ]}>
                                Tags
                            </Text>
                            <Animated.View style={tagsChevronStyle}>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color={colors.text}
                                />
                            </Animated.View>
                        </Pressable>
                    </Animated.View>

                    {/* Tags List */}
                    {isTagsExpanded && (
                        <Animated.View
                            entering={FadeIn.duration(250)}
                            exiting={FadeOut.duration(200)}
                            layout={LinearTransition.duration(350).easing(Easing.bezier(0.4, 0, 0.2, 1))}
                            style={styles.quickAccessList}
                        >
                            {tags.length === 0 ? (
                                <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
                                    No tags yet
                                </Text>
                            ) : (
                                tags.map(tag => (
                                    <HapticPressable
                                        key={tag.id}
                                        onPress={() => navigateToTag(tag.id)}
                                        onLongPress={() => setEditingTag(tag)}
                                        style={({ pressed }) => [
                                            styles.quickAccessItem,
                                            pressed && { opacity: 0.7 }
                                        ]}
                                    >
                                        <Ionicons name="ellipse" size={12} color={tag.color} />
                                        <Text style={[styles.quickAccessText, { color: tag.color }]} numberOfLines={1}>
                                            {tag.name}
                                        </Text>
                                    </HapticPressable>
                                ))
                            )}
                        </Animated.View>
                    )}
                </View>
            </ScrollView>



            {/* Footer Section */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
                {showOfflineBanner && (
                    <View style={styles.offlineBanner}>
                        <Ionicons name="cloud-offline-outline" size={16} color="#F59E0B" />
                        <Text style={[styles.offlineText, { color: colors.text }]}>Offline</Text>
                        <Pressable
                            onPress={handleRetry}
                            disabled={retryCooldown}
                            style={[styles.offlineRetryBtn, retryCooldown && { opacity: 0.4 }]}
                        >
                            <Text style={styles.offlineRetryText}>{retryCooldown ? 'Wait…' : 'Retry'}</Text>
                        </Pressable>
                    </View>
                )}

                <View style={styles.footerRow}>
                    <HapticPressable
                        onPress={navigateToTrash}
                        style={({ pressed }) => [
                            styles.footerItem,
                            pressed && { opacity: 0.7 }
                        ]}
                    >
                        <Ionicons name="trash-outline" size={22} color={colors.text} />
                        <Text style={[styles.footerText, { color: colors.text }]}>Trash</Text>
                    </HapticPressable>

                    <HapticPressable
                        onPress={navigateToSettings}
                        style={({ pressed }) => [
                            styles.iconButton,
                            pressed && { opacity: 0.7 }
                        ]}
                    >
                        <Ionicons name="settings-outline" size={24} color={colors.text} />
                    </HapticPressable>
                </View>
            </View>

            {/* Folder Edit Modal */}
            <FolderEditModal
                visible={editingFolder !== null}
                folder={editingFolder}
                onClose={() => setEditingFolder(null)}
            />

            {/* Tag Edit Modal */}
            <TagEditModal
                visible={editingTag !== null}
                tag={editingTag}
                onClose={() => setEditingTag(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
    },
    section: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    separator: {
        height: 0.5,
        marginHorizontal: 20,
        marginVertical: 4,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 12,
    },
    sidebarItemText: {
        fontSize: 17,
        fontWeight: '500',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    folderContainer: {
        marginTop: 4,
        paddingLeft: 4,
    },
    folderToggle: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 2,
    },
    folderTogglePlaceholder: {
        width: 20,
        height: 20,
        marginRight: 2,
    },
    folderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingRight: 12,
        borderRadius: 8,
    },
    folderItemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        marginRight: 8,
    },
    folderIconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    folderItemText: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 12,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    footerText: {
        fontSize: 16,
        fontWeight: '500',
    },
    quickAccessList: {
        paddingLeft: 12,
        marginBottom: 8,
    },
    quickAccessItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 8,
    },
    quickAccessText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    emptyText: {
        fontSize: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontStyle: 'italic',
    },
    iconButton: {
        padding: 4,
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    offlineText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    offlineRetryBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
    offlineRetryText: {
        color: '#6366F1',
        fontSize: 12,
        fontWeight: '600',
    },
});
