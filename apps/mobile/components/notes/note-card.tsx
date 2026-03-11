import SwipeableItem, { SwipeAction } from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatRelativeDate } from '@/utils/date-formatter';
import { NoteMetadata, useNotesStore, useSettingsStore } from '@annota/core';
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
    const { tags } = useNotesStore();
    const isCompact = general.compactMode;
    const shouldShowTimestamp = showTimestamp ?? !isCompact;

    const showTopBorder = !isFirst;
    const showBottomBorder = !isLast;

    let appliedTagIds: string[] = [];
    try {
        if (note.tags) appliedTagIds = JSON.parse(note.tags);
    } catch { }
    const appliedTags = appliedTagIds.map(id => tags.find(t => t.id === id)).filter(Boolean) as any[];

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
                <View style={[styles.mainRow, isCompact && { alignItems: 'center' }]}>
                    <View style={styles.titleWrapper}>
                        <ThemedText style={[styles.title, { flex: 0, flexShrink: 1 }]} numberOfLines={1}>
                            {note.title || 'Untitled Note'}
                        </ThemedText>
                        {isCompact && appliedTags.length > 0 && (
                            <View style={[styles.tagsContainer, { marginTop: 0, flexWrap: 'nowrap' }]}>
                                {appliedTags.slice(0, 3).map(tag => (
                                    <View key={tag.id} style={[styles.tagBadge, { backgroundColor: `${tag.color}15`, borderColor: `${tag.color}40` }]}>
                                        <ThemedText style={[styles.tagBadgeText, { color: tag.color }]}>{tag.name}</ThemedText>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    {shouldShowTimestamp && (
                        <ThemedText style={[styles.timestamp, { color: colors.text + '50' }]}>
                            {formatRelativeDate(note.updatedAt)}
                        </ThemedText>
                    )}
                </View>

                {!isCompact && appliedTags.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {appliedTags.map(tag => (
                            <View key={tag.id} style={[styles.tagBadge, { backgroundColor: `${tag.color}15`, borderColor: `${tag.color}40` }]}>
                                <ThemedText style={[styles.tagBadgeText, { color: tag.color }]}>{tag.name}</ThemedText>
                            </View>
                        ))}
                    </View>
                )}

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

        if (onToggleQuickAccess) {
            rightActions.push({
                icon: note.isQuickAccess ? 'star' : 'star-outline' as const,
                backgroundColor: '#FBBF24',
                onPress: onToggleQuickAccess,
            });
        }

        if (onTogglePin) {
            rightActions.push({
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

        if (rightActions.length > 0) {
            return (
                <SwipeableItem
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
    titleWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        overflow: 'hidden',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
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
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    tagBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
    },
    tagBadgeText: {
        fontSize: 10,
        fontWeight: '600',
    },
});
