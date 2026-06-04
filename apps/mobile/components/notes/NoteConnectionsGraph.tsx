import { useNotesStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface NoteConnectionsGraphProps {
    noteId: string;
    backlinks: any[];
    forwardLinks: any[];
    onClose: () => void;
}

export function NoteConnectionsGraph({ noteId, backlinks, forwardLinks, onClose }: NoteConnectionsGraphProps) {
    const { colors } = useTheme();
    const router = useRouter();
    const { getNoteById, folders } = useNotesStore();
    const note = getNoteById(noteId);

    const displayBacklinks = useMemo(() => backlinks.slice(0, 10), [backlinks]);
    const displayForwardLinks = useMemo(() => forwardLinks.slice(0, 10), [forwardLinks]);

    const getNoteFolderColor = (targetNoteId: string, isCurrent: boolean = false) => {
        const targetNote = isCurrent ? note : useNotesStore.getState().notes.find(n => n.id === targetNoteId);
        if (!targetNote || !targetNote.folderId) return colors.text + '50';
        const folder = folders.find(f => f.id === targetNote.folderId);
        return folder?.color || colors.text + '50';
    };

    if (!note) return null;

    return (
        <View style={styles.mapContainer}>
            {/* Vertical Center Spine Line (Axis boundary) */}
            <View style={[styles.verticalSpine, { backgroundColor: colors.border }]} pointerEvents="none" />

            {/* Left Column: Backlinks */}
            <View style={styles.columnLeft}>
                {displayBacklinks.length > 0 ? (
                    displayBacklinks.map((link) => {
                        const folderColor = getNoteFolderColor(link.id);
                        return (
                            <View key={link.id} style={styles.rowRight}>
                                <Pressable
                                    onPress={() => {
                                        onClose();
                                        router.push({
                                            pathname: '/Notes/[id]',
                                            params: {
                                                id: link.id,
                                                source: 'link',
                                                ...(link.blockId ? { blockId: link.blockId } : {})
                                            }
                                        });
                                    }}
                                    style={({ pressed }) => [
                                        styles.pill,
                                        styles.pillLeft,
                                        {
                                            borderColor: folderColor + '40',
                                            backgroundColor: folderColor + '10',
                                        },
                                        pressed && { backgroundColor: folderColor + '25' }
                                    ]}
                                >
                                    <Text numberOfLines={1} style={[styles.pillText, { color: folderColor }]}>
                                        {link.title || 'Untitled Note'}
                                    </Text>
                                </Pressable>
                                {/* Connector Line - absolute on right boundary */}
                                <View style={[styles.lineLeft, { backgroundColor: folderColor + '30' }]} />
                                {/* Dot - centered exactly on the spine */}
                                <View style={[styles.dotLeft, { backgroundColor: folderColor, borderColor: colors.card }]} />
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.rowRight}>
                        <Text style={[styles.emptyLabel, styles.pillLeft, { color: colors.text + '30', borderColor: colors.border + '60' }]}>
                            No backlinks
                        </Text>
                        <View style={[styles.lineLeft, { backgroundColor: colors.border + '20' }]} />
                        <View style={[styles.dotLeft, { backgroundColor: colors.border + '20', borderColor: colors.card }]} />
                    </View>
                )}
            </View>

            {/* Right Column: Forward Links */}
            <View style={styles.columnRight}>
                {displayForwardLinks.length > 0 ? (
                    displayForwardLinks.map((link) => {
                        const folderColor = getNoteFolderColor(link.id);
                        return (
                            <View key={link.id} style={styles.rowLeft}>
                                {/* Dot - centered exactly on the spine */}
                                <View style={[styles.dotRight, { backgroundColor: folderColor, borderColor: colors.card }]} />
                                {/* Connector Line - absolute on left boundary */}
                                <View style={[styles.lineRight, { backgroundColor: folderColor + '30' }]} />
                                <Pressable
                                    onPress={() => {
                                        onClose();
                                        router.push({
                                            pathname: '/Notes/[id]',
                                            params: {
                                                id: link.id,
                                                source: 'link',
                                                ...(link.blockId ? { blockId: link.blockId } : {})
                                            }
                                        });
                                    }}
                                    style={({ pressed }) => [
                                        styles.pill,
                                        styles.pillRight,
                                        {
                                            borderColor: folderColor + '40',
                                            backgroundColor: folderColor + '10',
                                        },
                                        pressed && { backgroundColor: folderColor + '25' }
                                    ]}
                                >
                                    <Text numberOfLines={1} style={[styles.pillText, { color: folderColor }]}>
                                        {link.title || 'Untitled Note'}
                                    </Text>
                                </Pressable>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.rowLeft}>
                        <View style={[styles.dotRight, { backgroundColor: colors.border + '20', borderColor: colors.card }]} />
                        <View style={[styles.lineRight, { backgroundColor: colors.border + '20' }]} />
                        <Text style={[styles.emptyLabel, styles.pillRight, { color: colors.text + '30', borderColor: colors.border + '60' }]}>
                            No links
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    linksCard: {
        marginHorizontal: 20,
        marginVertical: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    mapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    mapTitle: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    mapContainer: {
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        minHeight: 90,
        position: 'relative',
    },
    columnLeft: {
        width: '50%',
        justifyContent: 'center',
        gap: 10,
    },
    columnRight: {
        width: '50%',
        justifyContent: 'center',
        gap: 10,
    },
    verticalSpine: {
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        width: 1.5,
        marginLeft: -0.75, // Centers the line perfectly on the 50% boundary
        opacity: 0.3,
    },
    rowRight: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'relative',
        height: 24, // Consistent height for absolute items alignment
    },
    rowLeft: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
        height: 24, // Consistent height for absolute items alignment
    },
    pill: {
        borderRadius: 100,
        borderWidth: 1,
        paddingVertical: 3,
        paddingHorizontal: 8,
        maxWidth: 100,
    },
    pillText: {
        fontSize: 9,
        fontWeight: '600',
    },
    pillLeft: {
        marginRight: 10,
    },
    pillRight: {
        marginLeft: 10,
    },
    lineLeft: {
        position: 'absolute',
        right: 0,
        width: 10,
        height: 1,
    },
    lineRight: {
        position: 'absolute',
        left: 0,
        width: 10,
        height: 1,
    },
    dotLeft: {
        position: 'absolute',
        right: -3, // Centers the 6px dot perfectly on the spine
        width: 6,
        height: 6,
        borderRadius: 3,
        borderWidth: 1,
        zIndex: 10,
    },
    dotRight: {
        position: 'absolute',
        left: -3, // Centers the 6px dot perfectly on the spine
        width: 6,
        height: 6,
        borderRadius: 3,
        borderWidth: 1,
        zIndex: 10,
    },
    emptyLabel: {
        fontSize: 8,
        fontStyle: 'italic',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 100,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
});
