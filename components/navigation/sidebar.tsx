import { useAppTheme } from '@/hooks/use-app-theme';
import { DAILY_NOTES_FOLDER_ID, useNotesStore, type Folder } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticPressable } from '../ui/haptic-pressable';



interface SidebarItemProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    iconColor?: string;
    isActive?: boolean;
}

function SidebarItem({ icon, label, onPress, iconColor, isActive }: SidebarItemProps) {
    const { colors } = useAppTheme();

    return (
        <HapticPressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.sidebarItem,
                isActive && { backgroundColor: colors.primary + '15' },
                pressed && { opacity: 0.7 },
            ]}
        >
            <Ionicons
                name={icon}
                size={22}
                color={iconColor || (isActive ? colors.primary : colors.text)}
            />
            <Text style={[
                styles.sidebarItemText,
                { color: isActive ? colors.primary : colors.text }
            ]}>
                {label}
            </Text>
        </HapticPressable>
    );
}

interface FolderTreeItemProps {
    folder: Folder;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    onToggle: () => void;
    onNavigate: () => void;
    renderChildren: () => React.ReactNode;
}

function FolderTreeItem({
    folder,
    depth,
    isExpanded,
    hasChildren,
    onToggle,
    onNavigate,
    renderChildren,
}: FolderTreeItemProps) {
    const { colors } = useAppTheme();

    return (
        <View>
            <Pressable
                onPress={hasChildren ? onToggle : undefined}
                style={({ pressed }) => [
                    styles.folderRow,
                    { paddingLeft: 12 + depth * 14 },
                    pressed && hasChildren && { backgroundColor: colors.border + '20' },

                ]}
            >
                <Pressable
                    onPress={onNavigate}
                    style={({ pressed }) => [
                        styles.folderItemButton,
                        pressed && { opacity: 0.7 },
                    ]}
                >
                    <Ionicons
                        name={(folder.icon as keyof typeof Ionicons.glyphMap) || 'folder'}
                        size={18}
                        color={folder.color}
                    />
                    <Text style={[styles.folderItemText, { color: colors.text }]} numberOfLines={1}>
                        {folder.name}
                    </Text>
                </Pressable>

                {hasChildren ? (
                    <View style={styles.folderToggle}>
                        <Ionicons
                            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                            size={16}
                            color={colors.text}
                        />
                    </View>
                ) : (
                    <View style={styles.folderTogglePlaceholder} />
                )}
            </Pressable>

            {hasChildren && isExpanded ? renderChildren() : null}

        </View>
    );
}

function Separator() {
    const { colors } = useAppTheme();
    return (
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
    );
}

export default function Sidebar(props: DrawerContentComponentProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const { folders, notes, getFoldersInFolder } = useNotesStore();
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [isQuickAccessExpanded, setIsQuickAccessExpanded] = useState(false);

    // Get non-system top-level folders
    const topLevelFolders = useMemo(() => {
        return folders.filter(f => f.parentId === null && !f.isSystem);
    }, [folders]);

    // Get Filtered Quick Access Notes
    const quickAccessNotes = useMemo(() => {
        return notes.filter(n => n.isQuickAccess && !n.isDeleted);
    }, [notes]);

    const closeDrawer = () => {
        props.navigation.closeDrawer();
    };

    const navigateToNotes = (folderId?: string) => {
        closeDrawer();
        if (folderId) {
            router.push({ pathname: '/Notes', params: { folderId } });
        } else {
            router.push('/Notes');
        }
    };

    const navigateToDailyNote = async () => {
        const noteId = await useNotesStore.getState().getOrCreateDailyNote();
        closeDrawer();
        router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
    };

    const navigateToTasks = () => {
        closeDrawer();
        router.push('/Tasks');
    };

    const navigateToTrash = () => {
        closeDrawer();
        router.push('/Notes/trash');
    };

    const navigateToHome = () => {
        closeDrawer();
        router.push('/');
    };

    const navigateToSettings = () => {
        closeDrawer();
        router.push('/settings');
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode => {
        const children = folders.filter(f => f.parentId === parentId && !f.isSystem);
        if (children.length === 0) return null;

        return (
            <View>
                {children.map((folder) => {
                    const nested = folders.filter(f => f.parentId === folder.id && !f.isSystem);
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
                            renderChildren={() => renderFolderTree(folder.id, depth + 1)}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
                <Image
                    source={require('@/assets/images/icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={[styles.headerTitle, { color: colors.text }]}>Annota</Text>
            </View>

            <DrawerContentScrollView
                {...props}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Top Section */}
                <View style={styles.section}>
                    <SidebarItem
                        icon="home"
                        label="Home"
                        onPress={navigateToHome}
                        iconColor={'#4F7DF3'}
                    />

                    <SidebarItem
                        icon="checkmark-circle"
                        label="Tasks"
                        onPress={navigateToTasks}
                        iconColor={'#2ECC71'}
                    />

                    <SidebarItem
                        icon={(folders.find(f => f.id === DAILY_NOTES_FOLDER_ID)?.icon as keyof typeof Ionicons.glyphMap) || "calendar"}
                        label={"Daily Note"}
                        onPress={navigateToDailyNote}
                        iconColor={folders.find(f => f.id === DAILY_NOTES_FOLDER_ID)?.color || '#F59E0B'}
                    />

                    <Pressable
                        onPress={() => setIsQuickAccessExpanded(!isQuickAccessExpanded)}
                        style={({ pressed }) => [
                            styles.sidebarItem,
                            pressed && { opacity: 0.7 },
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
                        <Ionicons
                            name={isQuickAccessExpanded ? 'chevron-down' : 'chevron-forward'} // Or chevron-forward if collapsed
                            size={16}
                            color={colors.text}
                        />
                    </Pressable>

                    {/* Quick Access List */}
                    {isQuickAccessExpanded && (
                        <View style={styles.quickAccessList}>
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
                                            pressed && {
                                                backgroundColor: colors.primary + '15',
                                                opacity: 0.7
                                            }
                                        ]}
                                    >
                                        <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                                        <Text style={[styles.quickAccessText, { color: colors.text }]} numberOfLines={1}>
                                            {note.title || 'Untitled Note'}
                                        </Text>
                                    </HapticPressable>
                                ))
                            )}
                        </View>
                    )}


                </View>

                <Separator />

                {/* Middle Section: All Notes & Folders */}
                <View style={styles.section}>
                    <SidebarItem
                        icon="documents"
                        label="All Notes"
                        iconColor='#559bd8ff'
                        onPress={() => navigateToNotes()}
                    />

                    <View style={styles.folderContainer}>
                        {topLevelFolders.map((folder) => {
                            const nested = folders.filter(f => f.parentId === folder.id && !f.isSystem);
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
                                    renderChildren={() => renderFolderTree(folder.id, 1)}
                                />
                            );
                        })}
                    </View>
                </View>
            </DrawerContentScrollView>

            {/* Footer Section */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
                <HapticPressable onPress={navigateToTrash} style={styles.footerItem}>
                    <Ionicons name="trash-outline" size={22} color={colors.text} />
                    <Text style={[styles.footerText, { color: colors.text }]}>Trash</Text>
                </HapticPressable>

                <HapticPressable onPress={navigateToSettings} style={styles.iconButton}>
                    <Ionicons name="settings-outline" size={24} color={colors.text} />
                </HapticPressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    scrollContent: {
        paddingTop: 8,
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
    folderItemText: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
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
    }
});
