import { useNotesStore } from '@annota/core';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TagCommandMenuProps {
    noteId: string;
    query: string;
    range: { from: number; to: number };
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
}

export function TagCommandMenu({ noteId, query, range, sendCommand, onClose }: TagCommandMenuProps) {
    const { colors } = useTheme();
    const { tags, notes, addTagToNote, removeTagFromNote } = useNotesStore();
    const note = notes.find(n => n.id === noteId);

    const appliedTagIds = useMemo(() => {
        if (!note || !note.tags) return [];
        try {
            return JSON.parse(note.tags) as string[];
        } catch {
            return [];
        }
    }, [note]);

    const normalizedQuery = query.toLowerCase().trim();

    const displayTags = useMemo(() => {
        if (!normalizedQuery) return tags;
        return tags.filter(t => t.name.toLowerCase().includes(normalizedQuery));
    }, [tags, normalizedQuery]);

    const exactMatch = tags.find(t => t.name.toLowerCase() === normalizedQuery);
    const showCreateOption = normalizedQuery.length > 0 && !exactMatch;

    const items = useMemo(() => {
        const result: Array<{ type: 'create' | 'tag', tag?: any, title: string, isApplied?: boolean }> = [];
        if (showCreateOption) {
            result.push({ type: 'create', title: `Create "${query}"` });
        }
        displayTags.forEach(t => {
            result.push({ type: 'tag', tag: t, title: t.name, isApplied: appliedTagIds.includes(t.id) });
        });
        return result;
    }, [showCreateOption, query, displayTags, appliedTagIds]);

    const handleSelect = async (item: typeof items[0]) => {
        // 1. Delete the exact text range of the tag command ("#query")
        sendCommand('deleteSelection', { from: range.from, to: range.to });

        // 2. Execute the selected action
        if (item.type === 'create') {
            const newTag = {
                name: query.trim(),
            };
            await addTagToNote(noteId, newTag);
        } else if (item.type === 'tag' && item.tag) {
            if (item.isApplied) {
                await removeTagFromNote(noteId, item.tag.id);
            } else {
                await addTagToNote(noteId, item.tag);
            }
        }

        // 3. Close the menu
        onClose();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {items.map((item, index) => {
                    const isApplied = item.isApplied;
                    return (
                        <TouchableOpacity
                            key={item.type === 'create' ? 'create' : item.tag.id}
                            style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border, opacity: isApplied ? 0.6 : 1 }]}
                            onPress={() => handleSelect(item)}
                        >
                            <MaterialIcons
                                name={item.type === 'create' ? 'add' : 'local-offer'}
                                size={18}
                                color={item.tag ? item.tag.color : colors.text}
                                style={styles.icon}
                            />
                            <Text style={[styles.itemText, { color: colors.text, textDecorationLine: isApplied ? 'line-through' : 'none' }]}>
                                {item.title}
                            </Text>
                            {isApplied && (
                                <MaterialIcons name="check" size={14} color={colors.text} style={{ marginLeft: 4, opacity: 0.5 }} />
                            )}
                        </TouchableOpacity>
                    );
                })}

                {items.length === 0 && (
                    <Text style={[styles.noResultText, { color: colors.border }]}>No tags found</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 60,
        borderTopWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    icon: {
        marginRight: 6,
    },
    itemText: {
        fontSize: 14,
        fontWeight: '500',
    },
    noResultText: {
        fontSize: 14,
        paddingHorizontal: 16,
    }
});
