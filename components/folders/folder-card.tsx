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
    extraMarginTop?: boolean;
}

export default function FolderCard({
    folder,
    onPress,
    onLongPress,
    onDelete,
    swipeable = true,
    extraMarginTop = false
}: FolderCardProps) {
    const { colors, dark } = useTheme();
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;
    const folderColor = folder.color || '#F59E0B'; // Fallback to amber if no color set

    const CardContent = (
        <ThemedPressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                styles.folderCard,
                {
                    backgroundColor: colors.card,
                    borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    marginTop: extraMarginTop ? (isCompact ? 8 : 16) : 0,
                    padding: isCompact ? 10 : 14,
                },
                pressed && styles.pressed,
            ]}
        >
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
            <SwipeableItem onDelete={onDelete}>
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
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
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
        transform: [{ scale: 0.98 }],
    },
});
