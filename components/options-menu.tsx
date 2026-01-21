import { getSortTypeLabel, SortType } from '@/dev-data/data';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SORT_OPTIONS: SortType[] = [
    'NAME_ASC',
    'NAME_DESC',
    'CREATED_FIRST',
    'CREATED_LAST',
    'UPDATED_FIRST',
    'UPDATED_LAST',
];

interface OptionsMenuProps {
    currentSortType: SortType;
    onNewFolder: () => void;
    onSortChange: (sortType: SortType) => void;
    onTrash: () => void;
    onSettings: () => void;
}

export default function OptionsMenu({
    currentSortType,
    onNewFolder,
    onSortChange,
    onTrash,
    onSettings,
}: OptionsMenuProps) {
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();
    const [isVisible, setIsVisible] = useState(false);
    const [showSortSubmenu, setShowSortSubmenu] = useState(false);

    const handleClose = () => {
        setIsVisible(false);
        setShowSortSubmenu(false);
    };

    const handleNewFolder = () => {
        handleClose();
        onNewFolder();
    };

    const handleSortSelect = (sortType: SortType) => {
        onSortChange(sortType);
        handleClose();
    };

    const handleTrash = () => {
        handleClose();
        onTrash();
    };

    const handleSettings = () => {
        handleClose();
        onSettings();
    };

    return (
        <>
            {/* Options Button */}
            <View style={[styles.buttonContainer, { bottom: 20 + insets.bottom, right: 20 }]}>
                <Pressable
                    onPress={() => setIsVisible(true)}
                    style={({ pressed }) => [
                        styles.optionsButton,
                        {
                            backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                            borderColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                        },
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
                </Pressable>
            </View>

            {/* Options Modal */}
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
                            {
                                backgroundColor: colors.card,
                                bottom: 75 + insets.bottom,
                            },
                        ]}
                    >
                        {/* Main Menu */}
                        {!showSortSubmenu && (
                            <>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        pressed && { backgroundColor: colors.border + '30' },
                                    ]}
                                    onPress={handleNewFolder}
                                >
                                    <Ionicons name="folder-open-outline" size={20} color={colors.text} />
                                    <Text style={[styles.menuItemText, { color: colors.text }]}>New Folder</Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        pressed && { backgroundColor: colors.border + '30' },
                                    ]}
                                    onPress={() => setShowSortSubmenu(true)}
                                >
                                    <Ionicons name="swap-vertical-outline" size={20} color={colors.text} />
                                    <Text style={[styles.menuItemText, { color: colors.text }]}>Sort By</Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.text + '60'} style={styles.chevron} />
                                </Pressable>

                                <View style={[styles.divider, { backgroundColor: colors.border + '30' }]} />

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        pressed && { backgroundColor: colors.border + '30' },
                                    ]}
                                    onPress={handleTrash}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.text} />
                                    <Text style={[styles.menuItemText, { color: colors.text }]}>Trash</Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        pressed && { backgroundColor: colors.border + '30' },
                                    ]}
                                    onPress={handleSettings}
                                >
                                    <Ionicons name="settings-outline" size={20} color={colors.text} />
                                    <Text style={[styles.menuItemText, { color: colors.text }]}>Settings</Text>
                                </Pressable>
                            </>
                        )}

                        {/* Sort Submenu */}
                        {showSortSubmenu && (
                            <>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        pressed && { backgroundColor: colors.border + '30' },
                                    ]}
                                    onPress={() => setShowSortSubmenu(false)}
                                >
                                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                                    <Text style={[styles.menuItemText, { color: colors.text, fontWeight: '600' }]}>Sort By</Text>
                                </Pressable>

                                <View style={[styles.divider, { backgroundColor: colors.border + '30' }]} />

                                {SORT_OPTIONS.map((sortType) => (
                                    <Pressable
                                        key={sortType}
                                        style={({ pressed }) => [
                                            styles.menuItem,
                                            pressed && { backgroundColor: colors.border + '30' },
                                        ]}
                                        onPress={() => handleSortSelect(sortType)}
                                    >
                                        <View style={styles.sortIconContainer}>
                                            {currentSortType === sortType && (
                                                <Ionicons name="checkmark" size={18} color={colors.primary} />
                                            )}
                                        </View>
                                        <Text
                                            style={[
                                                styles.menuItemText,
                                                { color: colors.text },
                                                currentSortType === sortType && { color: colors.primary, fontWeight: '600' },
                                            ]}
                                        >
                                            {getSortTypeLabel(sortType)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </>
                        )}
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    buttonContainer: {
        position: 'absolute',
        zIndex: 100,

    },
    optionsButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    menuContainer: {
        position: 'absolute',
        right: 20,
        width: 220,
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
        paddingVertical: 12,
        gap: 12,
        borderRadius: 8,
    },
    menuItemText: {
        fontSize: 15,
        flex: 1,

    },
    chevron: {
        marginLeft: 'auto',
    },
    divider: {
        height: 1,
        marginVertical: 4,
    },
    sortIconContainer: {
        width: 20,
        alignItems: 'center',
    },
});
