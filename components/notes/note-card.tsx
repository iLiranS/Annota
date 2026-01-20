import SwipeableItem from '@/components/swipeable-item';
import ThemedText from '@/components/themed-text';
import ThemedPressable from '@/components/ui/themed-pressable';
import { NoteMetadata } from '@/stores/notes-store';
import { formatRelativeDate } from '@/utils/date-formatter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

interface NoteCardProps {
    note: NoteMetadata;
    onPress: () => void;
    onLongPress?: () => void;
    onDelete?: () => void;
    swipeable?: boolean;
}

export default function NoteCard({
    note,
    onPress,
    onLongPress,
    onDelete,
    swipeable = true
}: NoteCardProps) {
    const { colors, dark } = useTheme();

    const CardContent = (
        <ThemedPressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                styles.noteCard,
                {
                    backgroundColor: colors.card,
                    borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.noteHeader}>
                <View style={styles.titleRow}>
                    <Ionicons name="document-text" size={16} color="#6366F1" />
                    <ThemedText style={styles.title} numberOfLines={1}>
                        {note.title || 'Untitled Note'}
                    </ThemedText>
                </View>
                <View style={styles.timestampRow}>
                    <ThemedText style={[styles.timestamp, { color: colors.text + '60' }]}>
                        {formatRelativeDate(note.updatedAt)}
                    </ThemedText>
                </View>
            </View>
            <ThemedText
                style={[styles.preview, { color: colors.text + '70' }]}
                numberOfLines={1}
            >
                {note.preview}
            </ThemedText>
        </ThemedPressable>
    );

    if (swipeable && onDelete) {
        return (
            <SwipeableItem onDelete={onDelete}>
                {CardContent}
            </SwipeableItem>
        );
    }

    return CardContent;
}

const styles = StyleSheet.create({
    noteCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }],
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
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
