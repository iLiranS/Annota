import ThemedText from '@/components/themed-text';
import { NoteMetadata } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';

interface NoteListItemProps {
    note: NoteMetadata;
    onPress: () => void;
}

export default function NoteListItem({ note, onPress }: NoteListItemProps) {
    const { colors, dark } = useTheme();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.noteItem,
                {
                    backgroundColor: dark ? 'rgba(255,255,255,0.04)' : colors.card,
                    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                },
            ]}
        >
            <View style={[styles.noteIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
            </View>
            <View style={styles.noteItemContent}>
                <ThemedText style={styles.noteItemTitle} numberOfLines={1}>
                    {note.title || 'Untitled Note'}
                </ThemedText>
                <ThemedText style={[styles.noteItemDate, { color: colors.text + '50' }]}>
                    Last updated {new Date(note.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                    })}
                </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text + '40'} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    noteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    noteIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    noteItemContent: {
        flex: 1,
    },
    noteItemTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    noteItemDate: {
        fontSize: 12,
        fontWeight: '500',
    },
});
