import SwipeableItem, { SwipeAction } from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { NoteMetadata } from '@/lib/stores/notes.store';
import { useSettingsStore } from '@/lib/stores/settings.store';
import { formatRelativeDate } from '@/utils/date-formatter';
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
    isFirst?: boolean;
    isLast?: boolean;
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
    swipeable = true,
    isFirst = false,
    isLast = false,
}: NoteCardProps) {
    const { colors, dark } = useAppTheme();
    const { general } = useSettingsStore();
    const isCompact = general.compactMode;
    const shouldShowTimestamp = showTimestamp ?? !isCompact;

    const showTopBorder = !isFirst;
    const showBottomBorder = !isLast;

    const CardContent = (
        <ThemedPressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                styles.noteCard,
                pressed && styles.pressed,
                { paddingVertical: isCompact ? 10 : 16 }
            ]}
        >
            {showTopBorder && (
                <View style={[styles.border, styles.topBorder, { backgroundColor: colors.border }]} />
            )}
            {showBottomBorder && (
                <View style={[styles.border, styles.bottomBorder, { backgroundColor: colors.border }]} />
            )}

            <View style={styles.contentContainer}>
                <View style={styles.mainRow}>
                    <ThemedText style={styles.title} numberOfLines={1}>
                        {note.title || 'Untitled Note'}
                    </ThemedText>
                    {shouldShowTimestamp && (
                        <ThemedText style={[styles.timestamp, { color: colors.text + '50' }]}>
                            {formatRelativeDate(note.updatedAt)}
                        </ThemedText>
                    )}
                </View>

                {(description && showDescription) ? (
                    <View style={styles.descriptionContainer}>{description}</View>
                ) : (!isCompact && note.preview) ? (
                    <ThemedText
                        style={[styles.preview, { color: colors.text + '60' }]}
                        numberOfLines={1}
                    >
                        {note.preview}
                    </ThemedText>
                ) : null}
            </View>
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
                <SwipeableItem
                    leftActions={leftActions}
                    rightActions={rightActions}
                    compact={isCompact}
                >
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

    },
    pressed: {
        opacity: 0.7,
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
    contentContainer: {
        flex: 1,
    },
    mainRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
    },
    title: {
        fontSize: 17,
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
    descriptionContainer: {
        marginTop: 4,
    },
    preview: {
        fontSize: 14,
        marginTop: 4,
        lineHeight: 18,
    },
});
