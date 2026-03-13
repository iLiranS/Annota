import { useNotesStore } from '@annota/core';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function NoteTags({ noteId, style }: { noteId: string; style?: any }) {
    const { tags, notes, removeTagFromNote } = useNotesStore();
    const note = notes.find(n => n.id === noteId);

    const appliedTagIds = useMemo(() => {
        if (!note || !note.tags) return [];
        try {
            return JSON.parse(note.tags) as string[];
        } catch {
            return [];
        }
    }, [note]);

    if (appliedTagIds.length === 0) return null;

    const appliedTags = appliedTagIds.map(id => tags.find(t => t.id === id)).filter(Boolean);


    return (
        <View style={[{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 }, style]} pointerEvents="box-none">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent} pointerEvents="box-none">
                {appliedTags.filter(tag => tag !== undefined).map(tag => (
                    <View
                        key={tag.id}
                        style={[
                            styles.tag,
                            {
                                backgroundColor: `${tag.color}1A`,
                                borderColor: `${tag.color}40`,
                            }
                        ]}
                    >
                        <MaterialIcons name="local-offer" size={12} color={tag.color} style={styles.icon} />
                        <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
                        <TouchableOpacity
                            onPress={() => removeTagFromNote(noteId, tag.id!)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={styles.closeBtn}
                        >
                            <MaterialIcons name="close" size={14} color={tag.color} />
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
    },
    icon: {
        marginRight: 4,
        opacity: 0.8,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
    },
    closeBtn: {
        marginLeft: 6,
        padding: 2,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
    }
});
