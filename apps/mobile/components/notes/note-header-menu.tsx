import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useIsPremium } from '@annota/core';

interface NoteHeaderMenuProps {
    noteId: string;
    /** Whether the note is in quick access (starred) */
    isQuickAccess?: boolean;
    /** Whether the note is pinned */
    isPinned?: boolean;
    /** Whether the note is deleted */
    isDeleted?: boolean;
    /** Whether the note is published */
    isPublished?: boolean;
    /** Whether the note has unpublished local changes */
    hasUnpublishedChanges?: boolean;
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
    /** Callback when restore is pressed */
    onRestore?: () => void;
    /** Callback when note info is pressed */
    onNoteInfo?: () => void;
    /** Callback when publish toggle is pressed */
    onPublish?: () => void;
    /** Callback when unpublish is pressed */
    onUnpublish?: () => void;
}

export default function NoteHeaderMenu({
    noteId,
    isQuickAccess = false,
    isPinned = false,
    isDeleted = false,
    isPublished = false,
    hasUnpublishedChanges = false,
    onSearch,
    onToggleQuickAccess,
    onTogglePin,
    onVersionHistory,
    onCopyLink,
    onExport,
    onDelete,
    onRestore,
    onNoteInfo,
    onPublish,
    onUnpublish,
}: NoteHeaderMenuProps) {
    const { colors } = useAppTheme();
    const router = useRouter();

    const isPremium = useIsPremium();

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
        else if (id === 'restore') onRestore?.();
        else if (id === 'publish') {
            Alert.alert(
                isPublished ? "Update publish?" : "Publish note?",
                "Are you sure you want to publish this note? Anyone with the link will be able to view all its data!",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: isPublished ? "Update" : "Publish", onPress: () => onPublish?.() }
                ]
            );
        }
        else if (id === 'unpublish') {
            onUnpublish?.();
        }
    };

    const actions: MenuAction[] = isDeleted
        ? [
            {
                id: 'search',
                title: 'Search in note',
                image: 'magnifyingglass',
                imageColor: colors.primary,
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
                id: 'restore',
                title: 'Restore Note',
                image: 'arrow.uturn.backward',
                imageColor: "#22C55E",
                titleColor: "#22C55E"
            },
        ]
        : [
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
                state: isQuickAccess ? 'on' as const : 'off' as const,
            },
            {
                id: 'pin',
                title: 'Pin Note',
                image: isPinned ? 'pin.fill' : 'pin',
                imageColor: colors.primary,
                state: isPinned ? 'on' as const : 'off' as const,
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
            ...(isPremium ? [
                {
                    id: 'publish',
                    title: !isPublished 
                        ? 'Publish Note' 
                        : hasUnpublishedChanges 
                            ? 'Update Publish' 
                            : 'Published',
                    image: 'globe',
                    imageColor: colors.primary,
                    state: isPublished ? 'on' as const : 'off' as const,
                },
                ...(isPublished ? [{
                    id: 'unpublish',
                    title: 'Unpublish Note',
                    image: 'eye.slash',
                    imageColor: '#FF3B30',
                    attributes: { destructive: true },
                }] : []),
            ] as MenuAction[] : []),
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
        ];

    return (
        <MenuView

            onPressAction={({ nativeEvent }) => handleAction(nativeEvent.event)}
            actions={actions}
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
