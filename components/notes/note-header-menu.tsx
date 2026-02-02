import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

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
}

interface MenuItemProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    iconColor?: string;
    textColor?: string;
    rightElement?: React.ReactNode;
}

function MenuItem({ icon, label, onPress, iconColor, textColor, rightElement }: MenuItemProps) {
    const { colors } = useAppTheme();

    return (
        <HapticPressable
            style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: colors.text + '20' },
            ]}
            onPress={onPress}
        >
            <Ionicons name={icon} size={20} color={iconColor || colors.text} />
            <Text style={[styles.menuItemText, { color: textColor || colors.text }]}>{label}</Text>
            {rightElement}
        </HapticPressable>
    );
}

export default function NoteHeaderMenu({
    noteId,
    isQuickAccess: initialQuickAccess = false,
    isPinned: initialPinned = false,
    onSearch,
    onToggleQuickAccess,
    onTogglePin,
    onVersionHistory,
    onCopyLink,
    onExport,
    onDelete,
}: NoteHeaderMenuProps) {
    const { colors } = useAppTheme();
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);

    // Local state for dummy toggles
    const [isQuickAccess, setIsQuickAccess] = useState(initialQuickAccess);
    const [isPinned, setIsPinned] = useState(initialPinned);

    const handleClose = () => {
        setIsVisible(false);
    };

    const handleSearch = () => {
        handleClose();
        onSearch?.();
    };

    const handleToggleQuickAccess = () => {
        const newValue = !isQuickAccess;
        setIsQuickAccess(newValue);
        onToggleQuickAccess?.(newValue);
        // Don't close menu - let user see the state change
    };

    const handleTogglePin = () => {
        const newValue = !isPinned;
        setIsPinned(newValue);
        onTogglePin?.(newValue);
        // Don't close menu - let user see the state change
    };

    const handleVersionHistory = () => {
        handleClose();
        onVersionHistory?.();
    };

    const handleCopyLink = () => {
        handleClose();
        onCopyLink?.();
    };

    const handleExport = () => {
        handleClose();
        onExport?.();
    };

    const handleSettings = () => {
        handleClose();
        router.push('/settings');
    };

    const handleDelete = () => {
        handleClose();
        onDelete?.();
    };

    return (
        <>
            {/* Three dots button */}
            <HapticPressable
                onPress={() => setIsVisible(true)}
                style={({ pressed }) => [
                    styles.headerButton,
                    pressed && { backgroundColor: colors.text + '15' },
                ]}
                hitSlop={8}
            >
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </HapticPressable>

            {/* Menu Modal */}
            <Modal
                visible={isVisible}
                transparent
                animationType="fade"
                onRequestClose={handleClose}
            >
                <Pressable style={styles.overlay} onPress={handleClose}>
                    <View
                        style={[
                            styles.menuContainer,
                            { backgroundColor: colors.card },
                        ]}
                        onStartShouldSetResponder={() => true}
                    >
                        <MenuItem
                            icon="search-outline"
                            label="Search in note"
                            onPress={handleSearch}
                        />

                        <MenuItem
                            icon={isQuickAccess ? 'star' : 'star-outline'}
                            label="Quick access"
                            onPress={handleToggleQuickAccess}
                            iconColor="#FBBF24"
                            rightElement={
                                <Ionicons
                                    name={isQuickAccess ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={isQuickAccess ? colors.primary : colors.text + '60'}
                                />
                            }
                        />

                        <MenuItem
                            icon={isPinned ? 'pin' : 'pin-outline'}
                            label="Pin note"
                            onPress={handleTogglePin}
                            iconColor={isPinned ? colors.primary : colors.text}
                            rightElement={
                                <Ionicons
                                    name={isPinned ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={isPinned ? colors.primary : colors.text + '60'}
                                />
                            }
                        />

                        <View style={[styles.divider, { backgroundColor: colors.border + '30' }]} />

                        <MenuItem
                            icon="time-outline"
                            label="Version history"
                            onPress={handleVersionHistory}
                        />

                        <MenuItem
                            icon="link-outline"
                            label="Copy link to note"
                            onPress={handleCopyLink}
                        />

                        <MenuItem
                            icon="share-outline"
                            label="Export"
                            onPress={handleExport}
                        />

                        <View style={[styles.divider, { backgroundColor: colors.border + '30' }]} />

                        <MenuItem
                            icon="settings-outline"
                            label="Settings"
                            onPress={handleSettings}
                        />

                        <View style={[styles.divider, { backgroundColor: colors.border + '30' }]} />

                        <MenuItem
                            icon="trash-outline"
                            label="Delete note"
                            onPress={handleDelete}
                            iconColor="#EF4444"
                            textColor="#EF4444"
                        />
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    headerButton: {
        padding: 4,
        borderRadius: 20,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    menuContainer: {
        position: 'absolute',
        top: 60,
        right: 16,
        width: 240,
        borderRadius: 14,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
    },
    menuItemText: {
        fontSize: 15,
        flex: 1,
    },
    divider: {
        height: 1,
        marginVertical: 2,
    },
});
