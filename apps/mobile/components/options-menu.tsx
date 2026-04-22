import { useAppTheme } from '@/hooks/use-app-theme';
import { getSortTypeLabel, SortType } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { HapticPressable } from './ui/haptic-pressable';

const SORT_OPTIONS: SortType[] = [
    'NAME_ASC', 'NAME_DESC',
    'CREATED_FIRST', 'CREATED_LAST',
    'UPDATED_FIRST', 'UPDATED_LAST',
];

interface OptionsMenuProps {
    currentSortType: SortType;
    onNewFolder: () => void;
    onSortChange: (sort: SortType) => void;
    onTrash: () => void;
    onSettings: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    hideDefaultButton?: boolean;
    selectionMode?: boolean;
    onToggleSelectionMode?: () => void;
    isHeader?: boolean;
}

export default function OptionsMenu({
    currentSortType,
    onNewFolder,
    onSortChange,
    onTrash,
    onSettings,
    containerStyle,
    hideDefaultButton = false,
    selectionMode,
    onToggleSelectionMode,
    isHeader = false,
}: OptionsMenuProps) {
    const { colors } = useAppTheme();

    return (
        <MenuView
            title="Options"
            onPressAction={({ nativeEvent }) => {
                const { event } = nativeEvent;
                if (event === 'new-folder') onNewFolder();
                else if (event === 'toggle-selection') onToggleSelectionMode?.();
                else if (event === 'trash') onTrash();
                else if (event === 'settings') onSettings();
                else if (event.startsWith('sort-')) {
                    onSortChange(event.replace('sort-', '') as SortType);
                }
            }}
            actions={[
                {
                    id: 'new-folder',
                    title: 'New Folder',
                    image: 'folder.badge.plus',
                    imageColor: colors.primary,
                },
                ...(onToggleSelectionMode ? [{
                    id: 'toggle-selection',
                    title: selectionMode ? 'Cancel Selection' : 'Select Notes',
                    image: 'checkmark.circle',
                    imageColor: colors.primary,
                }] : []),
                {
                    id: 'sort',
                    title: 'Sort By',
                    image: 'arrow.up.arrow.down',
                    imageColor: colors.primary,
                    subactions: SORT_OPTIONS.map(s => ({
                        id: `sort-${s}`,
                        title: getSortTypeLabel(s),
                        image: s.includes('NAME') ? 'textformat' : 'calendar',
                        imageColor: colors.primary,
                        state: currentSortType === s ? 'on' : 'off',
                    })),
                },
                {
                    id: 'trash',
                    title: 'Trash',
                    image: 'trash',
                    imageColor: '#FF3B30', // Native iOS red
                    attributes: { destructive: true },
                },
                {
                    id: 'settings',
                    title: 'Settings',
                    image: 'gear',
                    imageColor: colors.primary,
                },
            ]}
        >
            <View style={[isHeader ? styles.headerWrapper : styles.optionsWrapper, containerStyle]}>
                {!hideDefaultButton && (
                    <HapticPressable style={isHeader ? styles.headerButton : [styles.optionsButton, { backgroundColor: colors.primary }]}>
                        <Ionicons
                            name="ellipsis-horizontal"
                            size={isHeader ? 24 : 20}
                            color={isHeader ? colors.primary : '#FFFFFF'}
                        />
                    </HapticPressable>
                )}
            </View>
        </MenuView>
    );
}

const styles = StyleSheet.create({
    headerWrapper: { width: 40, height: 40 },
    optionsWrapper: { width: 38, height: 38 },
    headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    optionsButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});