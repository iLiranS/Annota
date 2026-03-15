import { useNotesStore } from '@annota/core';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NoteLinkCommandMenuProps {
    query: string;
    range: { from: number; to: number };
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
}

export function NoteLinkCommandMenu({ query, range, sendCommand, onClose }: NoteLinkCommandMenuProps) {
    const { colors } = useTheme();
    const { notes } = useNotesStore();

    const normalizedQuery = query.toLowerCase().trim();

    const displayNotes = useMemo(() => {
        const filtered = notes.filter(n => !n.isDeleted && (n.title || 'Untitled').toLowerCase().includes(normalizedQuery));
        return filtered
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 7);
    }, [notes, normalizedQuery]);

    const handleSelect = (note: any) => {
        // 1. Delete the "[[query" text
        sendCommand('deleteSelection', { from: range.from, to: range.to });

        // 2. Insert the link
        sendCommand('setLink', {
            href: `annota://note/${note.id}`,
            title: note.title || 'Untitled Note'
        });

        // 3. Close the menu
        onClose();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={styles.header}>
                <MaterialIcons name="link" size={12} color={colors.text} style={{ opacity: 0.5, marginRight: 4 }} />
                <Text style={[styles.headerText, { color: colors.text }]}>LINK NOTE</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {displayNotes.map((note) => (
                    <TouchableOpacity
                        key={note.id}
                        style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => handleSelect(note)}
                    >
                        <MaterialIcons
                            name="description"
                            size={18}
                            color={colors.text}
                            style={styles.icon}
                        />
                        <Text style={[styles.itemText, { color: colors.text }]} numberOfLines={1}>
                            {note.title || 'Untitled Note'}
                        </Text>
                    </TouchableOpacity>
                ))}

                {displayNotes.length === 0 && (
                    <Text style={[styles.noResultText, { color: colors.border }]}>No notes found</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 70,
        borderTopWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 4,
    },
    headerText: {
        fontSize: 10,
        fontWeight: 'bold',
        opacity: 0.5,
    },
    scrollContent: {
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 8,
        borderWidth: StyleSheet.hairlineWidth,
        maxWidth: 200,
    },
    icon: {
        marginRight: 6,
        opacity: 0.7,
    },
    itemText: {
        fontSize: 13,
        fontWeight: '500',
    },
    noResultText: {
        fontSize: 14,
        paddingHorizontal: 16,
    }
});
