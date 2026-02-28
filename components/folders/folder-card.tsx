import SwipeableItem from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import { Folder } from '@/lib/stores/notes.store';
import { useSettingsStore } from '@/lib/stores/settings.store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

interface FolderCardProps {
    folder: Folder;
    onPress: () => void;
    onLongPress?: () => void;
    onDelete?: () => void;
    swipeable?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
}

export default function FolderCard({
    folder,
    onPress,
    onLongPress,
    onDelete,
    swipeable = true,
    isFirst = false,
    isLast = false,
}: FolderCardProps) {
    const { colors, dark } = useTheme();
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;
    const folderColor = folder.color || '#F59E0B'; // Fallback to amber if no color set

    const showTopBorder = !isFirst;
    const showBottomBorder = !isLast;

    const CardContent = (
        <ThemedPressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                styles.folderCard,
                {
                    paddingVertical: isCompact ? 12 : 16,
                    paddingHorizontal: 20,
                },
                pressed && styles.pressed,
            ]}
        >
            {showTopBorder && (
                <View style={[styles.border, styles.topBorder, { backgroundColor: colors.border }]} />
            )}
            {showBottomBorder && (
                <View style={[styles.border, styles.bottomBorder, { backgroundColor: colors.border }]} />
            )}

            <View style={[
                styles.folderIcon,
                {
                    backgroundColor: folderColor + '20',
                    width: isCompact ? 32 : 40,
                    height: isCompact ? 32 : 40,
                }
            ]}>
                <Ionicons name={folder.icon as keyof typeof Ionicons.glyphMap} size={isCompact ? 18 : 22} color={folderColor} />
            </View>
            <ThemedText style={[styles.folderName, isCompact && { fontSize: 15 }]}>{folder.name}</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={colors.text + '50'} />
        </ThemedPressable>
    );

    if (swipeable && onDelete && !folder.isSystem) {
        return (
            <SwipeableItem onDelete={onDelete} compact={isCompact}>
                {CardContent}
            </SwipeableItem>
        );
    }

    return CardContent;
}

const styles = StyleSheet.create({
    folderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 12,
        position: 'relative',
    },
    border: {
        position: 'absolute',
        left: '5%',
        right: '5%',
        height: StyleSheet.hairlineWidth,
    },
    topBorder: {
        top: 0,
    },
    bottomBorder: {
        bottom: 0,
    },
    folderIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    folderName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.7,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
});
