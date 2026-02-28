import SwipeableItem, { SwipeAction } from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { NoteMetadata } from '@/lib/stores/notes.store';
import { useSettingsStore } from '@/lib/stores/settings.store';
import { formatRelativeDate } from '@/utils/date-formatter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

interface NoteCardProps {
    note: NoteMetadata;
    onPress: () => void;
    onLongPress?: () => void;
    onDelete?: () => void;
    onToggleQuickAccess?: () => void;
    onTogglePin?: () => void;
    swipeable?: boolean;
    description?: React.ReactNode;
    showDescription?: boolean;
    showTimestamp?: boolean;
}

export default function NoteCard({
    note,
    onPress,
    onLongPress,
    onDelete,
    onToggleQuickAccess,
    onTogglePin,
    description,
    showDescription = true,
    showTimestamp,
    swipeable = true
}: NoteCardProps) {
    const { colors, dark } = useAppTheme();
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;
    const shouldShowTimestamp = showTimestamp ?? !isCompact;

    const CardContent = (
        <ThemedPressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                styles.noteCard,
                {
                    backgroundColor: colors.card,
                },
                isCompact && { paddingVertical: 12 },
                pressed && styles.pressed,
            ]}
        >
            <View style={[styles.noteHeader]}>
                <View style={styles.titleRow}>
                    <Ionicons name="document-text" size={16} color={colors.primary} />
                    <ThemedText style={styles.title} numberOfLines={1}>
                        {note.title || 'Untitled Note'}
                    </ThemedText>
                </View>
                {shouldShowTimestamp && (
                    <View style={styles.timestampRow}>
                        <ThemedText style={[styles.timestamp, { color: colors.text + '60' }]}>
                            {formatRelativeDate(note.updatedAt)}
                        </ThemedText>
                    </View>
                )}
            </View>
            {description && showDescription ? (
                description
            ) : !isCompact ? (
                <ThemedText
                    style={[styles.preview, { color: colors.text + '70' }]}
                    numberOfLines={1}
                >
                    {note.preview}
                </ThemedText>
            ) : null}
        </ThemedPressable>
    );

    if (swipeable) {
        const rightActions: SwipeAction[] = [];
        const leftActions: SwipeAction[] = [];

        if (onToggleQuickAccess) {
            leftActions.push({
                icon: note.isQuickAccess ? 'star' : 'star-outline' as const,
                backgroundColor: '#FBBF24',
                onPress: onToggleQuickAccess,
            });
        }

        if (onTogglePin) {
            leftActions.push({
                icon: note.isPinned ? 'pin' : 'pin-outline' as const,
                backgroundColor: colors.primary,
                onPress: onTogglePin,
            });
        }

        if (onDelete) {
            rightActions.push({
                icon: 'trash-outline' as const,
                backgroundColor: '#EF4444',
                onPress: onDelete,
            });
        }

        if (rightActions.length > 0 || leftActions.length > 0) {
            return (
                <SwipeableItem leftActions={leftActions} rightActions={rightActions}>
                    {CardContent}
                </SwipeableItem>
            );
        }
    }

    return CardContent;
}

const styles = StyleSheet.create({
    noteCard: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        // Border and radius removed for full-width list style
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',

    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    timestampRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timestamp: {
        fontSize: 12,
    },
    preview: {
        fontSize: 14,
        lineHeight: 20,
    },
});
