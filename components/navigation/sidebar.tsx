import { DAILY_NOTES_FOLDER_ID, useNotesStore, type Folder } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



interface SidebarItemProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    iconColor?: string;
    isActive?: boolean;
}

function SidebarItem({ icon, label, onPress, iconColor, isActive }: SidebarItemProps) {
    const { colors } = useTheme();

    return (
        <Pressable
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
        </Pressable>
    );
}

interface FolderItemProps {
    folder: Folder;
    onPress: () => void;
}

function FolderItem({ folder, onPress }: FolderItemProps) {
    const { colors } = useTheme();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.folderItem,
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
    );
}

function Separator() {
    const { colors } = useTheme();
    return (
        <View style={[styles.separator, { backgroundColor: colors.border + '40' }]} />
    );
}

export default function Sidebar(props: DrawerContentComponentProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const { folders, loadFoldersInFolder, getFoldersInFolder } = useNotesStore();

    // Load top-level folders on mount
    useEffect(() => {
        loadFoldersInFolder(null);
    }, [loadFoldersInFolder]);

    // Get non-system top-level folders
    const topLevelFolders = useMemo(() => {
        // Force refresh from store state
        return folders.filter(f => f.parentId === null && !f.isSystem);
    }, [folders]);

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

    const navigateToDailyNote = () => {
        closeDrawer();
        router.push({ pathname: '/Notes', params: { folderId: DAILY_NOTES_FOLDER_ID } });
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

    return (
        <View style={[styles.container, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <View style={styles.appIcon}>
                    <Ionicons name="document-text" size={24} color="#6366F1" />
                </View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
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
                        iconColor='#d89b55ff'
                    />

                    <SidebarItem
                        icon="checkmark-circle"
                        label="Tasks"
                        onPress={navigateToTasks}
                        iconColor="#6366F1"
                    />

                    <SidebarItem
                        icon="today"
                        label="Daily Note"
                        onPress={navigateToDailyNote}
                        iconColor="#4ddfb5ff"
                    />

                    <SidebarItem
                        icon="star"
                        label="Quick Access"
                        onPress={() => navigateToNotes()} // TODO: Implement Quick Access filter
                        iconColor="#FBBF24"
                    />


                </View>

                <Separator />

                {/* Middle Section: All Notes & Folders */}
                <View style={styles.section}>
                    <SidebarItem
                        icon="documents"
                        label="All Notes"
                        onPress={() => navigateToNotes()}
                    />

                    <View style={styles.folderContainer}>
                        {/* Folders List */}
                        {topLevelFolders.map((folder) => (
                            <FolderItem
                                key={folder.id}
                                folder={folder}
                                onPress={() => navigateToNotes(folder.id)}
                            />
                        ))}
                    </View>
                </View>
            </DrawerContentScrollView>

            {/* Footer Section */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border + '40' }]}>
                <Pressable onPress={navigateToTrash} style={styles.footerItem}>
                    <Ionicons name="trash-outline" size={22} color={colors.text} />
                    <Text style={[styles.footerText, { color: colors.text }]}>Trash</Text>
                </Pressable>

                <Pressable onPress={navigateToSettings} style={styles.iconButton}>
                    <Ionicons name="settings-outline" size={24} color={colors.text} />
                </Pressable>
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
        borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    },
    appIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#6366F1' + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    scrollContent: {
        paddingTop: 8,
    },
    section: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    separator: {
        height: 1,
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
    },
    folderContainer: {
        marginTop: 4,
        paddingLeft: 4,
    },
    folderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 10,
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
    iconButton: {
        padding: 4,
    }
});
