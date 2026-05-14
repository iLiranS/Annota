import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface NoteHeaderMenuProps {
    noteId: string;
    /** Whether the note is in quick access (starred) */
    isQuickAccess?: boolean;
    /** Whether the note is pinned */
    isPinned?: boolean;
    /** Callback when search is triggered */
    onSearch?: () => void;
    /** Callback when quick access toggle is pressed */
    onToggleQuickAccess?: (value: boolean) => void;
    /** Callback when pin toggle is pressed */
    onTogglePin?: (value: boolean) => void;
    /** Callback when version history is pressed */
    onVersionHistory?: () => void;
    /** Callback when copy link is pressed */
    onCopyLink?: () => void;
    /** Callback when export is pressed */
    onExport?: () => void;
    /** Callback when delete is pressed */
    onDelete?: () => void;
    /** Callback when note info is pressed */
    onNoteInfo?: () => void;
}

export default function NoteHeaderMenu({
    noteId,
    isQuickAccess = false,
    isPinned = false,
    onSearch,
    onToggleQuickAccess,
    onTogglePin,
    onVersionHistory,
    onCopyLink,
    onExport,
    onDelete,
    onNoteInfo,
}: NoteHeaderMenuProps) {
    const { colors } = useAppTheme();
    const router = useRouter();

    const handleAction = (id: string) => {
        if (id === 'search') onSearch?.();
        else if (id === 'quick-access') onToggleQuickAccess?.(!isQuickAccess);
        else if (id === 'pin') onTogglePin?.(!isPinned);
        else if (id === 'version-history') onVersionHistory?.();
        else if (id === 'note-info') onNoteInfo?.();
        else if (id === 'copy-link') onCopyLink?.();
        else if (id === 'export') {
            if (onExport) onExport();
            else router.push(`/Notes/${noteId}/export`);
        }
        else if (id === 'settings') router.push('/settings');
        else if (id === 'delete') onDelete?.();
    };

    return (
        <MenuView
            title="Note Options"
            onPressAction={({ nativeEvent }) => handleAction(nativeEvent.event)}
            actions={[
                {
                    id: 'search',
                    title: 'Search in note',
                    image: 'magnifyingglass',
                    imageColor: colors.primary,
                },
                {
                    id: 'quick-access',
                    title: 'Quick Access',
                    image: isQuickAccess ? 'star.fill' : 'star',
                    imageColor: '#FBBF24',
                    state: isQuickAccess ? 'on' : 'off',
                },
                {
                    id: 'pin',
                    title: 'Pin Note',
                    image: isPinned ? 'pin.fill' : 'pin',
                    imageColor: colors.primary,
                    state: isPinned ? 'on' : 'off',
                },
                {
                    id: 'version-history',
                    title: 'Version History',
                    image: 'clock',
                    imageColor: colors.primary,
                },
                {
                    id: 'note-info',
                    title: 'Note Info',
                    image: 'info.circle',
                    imageColor: colors.primary,
                },
                {
                    id: 'copy-link',
                    title: 'Copy Link',
                    image: 'link',
                    imageColor: colors.primary,
                },
                {
                    id: 'export',
                    title: 'Export',
                    image: 'square.and.arrow.up',
                    imageColor: colors.primary,
                },
                {
                    id: 'settings',
                    title: 'Settings',
                    image: 'gear',
                    imageColor: colors.primary,
                },
                {
                    id: 'delete',
                    title: 'Delete Note',
                    image: 'trash',
                    imageColor: '#FF3B30',
                    attributes: { destructive: true },
                },
            ]}
        >
            <View>
                <HapticPressable
                    style={({ pressed }) => [
                        styles.headerButton,
                        pressed && { backgroundColor: colors.text + '15' },
                    ]}
                    hitSlop={8}
                >
                    <Ionicons name="ellipsis-horizontal" size={24} color={colors.primary} />
                </HapticPressable>
            </View>
        </MenuView>
    );
}

const styles = StyleSheet.create({
    headerButton: {
        padding: 4,
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
