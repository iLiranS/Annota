import { SearchRepository, useNotesStore } from '@annota/core';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';

interface NoteLinkCommandMenuProps {
    query: string;
    range: { from: number; to: number };
    sendCommand: (cmd: string, params?: Record<string, unknown>) => void;
    onClose: () => void;
    noteId: string;
}

export function NoteLinkCommandMenu({ query, range, sendCommand, onClose, noteId }: NoteLinkCommandMenuProps) {
    const { colors } = useTheme();

    const [displayNotes, setDisplayNotes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let active = true;
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            // Fallback to recent notes from memory store
            const notes = useNotesStore.getState().notes;
            const filtered = notes.filter(n => !n.isDeleted && n.id !== noteId);
            const sorted = filtered
                .sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return dateB - dateA;
                })
                .slice(0, 10);
            setDisplayNotes(sorted);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(async () => {
            try {
                const results = await SearchRepository.searchNotes(query, null, 11);
                if (active) {
                    const filtered = results.filter(r => r.id !== noteId).slice(0, 10);
                    setDisplayNotes(filtered);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Failed to search notes for linking:', err);
                if (active) {
                    setIsLoading(false);
                }
            }
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [query, noteId]);

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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.text }]}>Searching...</Text>
                    </View>
                ) : (
                    displayNotes.map((note) => (
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
                    ))
                )}

                {!isLoading && displayNotes.length === 0 && (
                    <Text style={[styles.noResultText, { color: colors.border }]}>No notes found</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 50,
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
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        opacity: 0.6,
    },
});
