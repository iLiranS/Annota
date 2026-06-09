import { calculateNoteStats, useNotesStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { format } from 'date-fns/format';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoteConnectionsGraph } from './NoteConnectionsGraph';

interface TocItem {
    id: string;
    text: string;
    level: number;
}

interface NoteInfoModalProps {
    visible: boolean;
    onClose: () => void;
    noteId: string;
    onScrollToElement: (elementId: string) => void;
}

export default function NoteInfoModal({ visible, onClose, noteId, onScrollToElement }: NoteInfoModalProps) {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { getNoteById, getNoteContent, getForwardLinks, getBacklinks } = useNotesStore();
    const note = getNoteById(noteId);

    const [content, setContent] = useState<string | null>(null);
    const [forwardLinks, setForwardLinks] = useState<any[]>([]);
    const [backlinks, setBacklinks] = useState<any[]>([]);
    const [tocExpanded, setTocExpanded] = useState<boolean>(true);
    const [connectionsExpanded, setConnectionsExpanded] = useState<boolean>(true);
    const [statsExpanded, setStatsExpanded] = useState<boolean>(true);

    const hasForward = forwardLinks.length > 0;
    const hasBack = backlinks.length > 0;

    useEffect(() => {
        if (visible && noteId) {
            getNoteContent(noteId).then(setContent);
            getForwardLinks(noteId).then(setForwardLinks);
            getBacklinks(noteId).then(setBacklinks);
        }
        return () => {
            setContent(null);
            setForwardLinks([]);
            setBacklinks([]);
        };
    }, [visible, noteId, getNoteContent, getForwardLinks, getBacklinks]);

    const stats = useMemo(() => {
        return calculateNoteStats(content || "");
    }, [content]);

    const toc = useMemo(() => {
        if (!content) return [];
        const items: TocItem[] = [];
        const headerRegex = /<h([1-6])(?:\s+[^>]*)?data-id="([^"]+)"[^>]*>(.*?)<\/h\1>/gi;
        let match;
        while ((match = headerRegex.exec(content)) !== null) {
            const level = parseInt(match[1]);
            const id = match[2];
            const text = match[3].replace(/<[^>]*>/g, '').trim();
            if (text) {
                items.push({ id, text, level });
            }
        }
        return items;
    }, [content]);

    // For each item, compute the tree prefix string (e.g. "│   ├── ")
    // by walking ancestors and checking if each is the last of its siblings.
    const tocPrefixes = useMemo(() => {
        return toc.map((item, idx) => {
            if (item.level === 1) return "";

            // For each ancestor level, is that ancestor the last of its siblings?
            const isLastAtLevel: Record<number, boolean> = {};
            for (let lvl = 1; lvl < item.level; lvl++) {
                let ancestorIdx = -1;
                for (let i = idx - 1; i >= 0; i--) {
                    if (toc[i].level === lvl) { ancestorIdx = i; break; }
                }
                if (ancestorIdx === -1) continue;
                let isLast = true;
                for (let i = ancestorIdx + 1; i < toc.length; i++) {
                    if (toc[i].level < lvl) break;
                    if (toc[i].level === lvl) { isLast = false; break; }
                }
                isLastAtLevel[lvl] = isLast;
            }

            // Is this item the last among its siblings?
            let selfIsLast = true;
            for (let i = idx + 1; i < toc.length; i++) {
                if (toc[i].level < item.level) break;
                if (toc[i].level === item.level) { selfIsLast = false; break; }
            }

            // Build prefix: ancestor columns, then the connector for this item
            let prefix = "";
            for (let lvl = 1; lvl <= item.level - 2; lvl++) {
                prefix += isLastAtLevel[lvl] ? "    " : "│   ";
            }
            prefix += selfIsLast ? "└── " : "├── ";
            return prefix;
        });
    }, [toc]);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    };

    if (!note) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{note.title}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.text + '60'} />
                    </TouchableOpacity>
                </View>

                <View style={styles.mainContent}>
                    <ScrollView
                        style={styles.scrollArea}
                        contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: 10 }}
                    >
                        {/* Section 1: Table of Contents */}
                        <View style={{ marginBottom: 4 }}>
                            <TouchableOpacity
                                onPress={() => setTocExpanded(!tocExpanded)}
                                style={styles.accordionHeader}
                            >
                                <View style={styles.accordionHeaderLeft}>
                                    <Ionicons name="list-outline" size={14} color={colors.primary} />
                                    <Text style={[styles.accordionTitle, { color: colors.text }]}>TABLE OF CONTENTS</Text>
                                </View>
                                <Ionicons
                                    name={tocExpanded ? "chevron-down" : "chevron-forward"}
                                    size={16}
                                    color={colors.text + '40'}
                                />
                            </TouchableOpacity>

                            {tocExpanded && (
                                <View style={styles.accordionContent}>
                                    {toc.length === 0 ? (
                                        <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <Text style={[styles.emptyText, { color: colors.text + '40' }]}>No headers found</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.tocContainer}>
                                            {toc.map((item, idx) => {
                                                const prefix = tocPrefixes[idx];

                                                return (
                                                    <Pressable
                                                        key={`${item.id}-${idx}`}
                                                        onPress={() => {
                                                            onScrollToElement(item.id);
                                                            onClose();
                                                        }}
                                                        style={({ pressed }) => [
                                                            styles.tocTextButton,
                                                            pressed && { backgroundColor: colors.primary + '25' }
                                                        ]}
                                                    >
                                                        {({ pressed }) => (
                                                            <View style={styles.tocItem}>
                                                                {!!prefix && (
                                                                    <Text style={[styles.tocPrefix, { color: colors.text + '25' }]}>
                                                                        {prefix}
                                                                    </Text>
                                                                )}
                                                                <Text
                                                                    numberOfLines={1}
                                                                    style={[
                                                                        styles.tocText,
                                                                        { color: pressed ? colors.primary : colors.text + '80' },
                                                                        item.level === 1 && styles.tocTextH1,
                                                                        item.level === 2 && styles.tocTextH2,
                                                                        item.level === 3 && styles.tocTextH3,
                                                                        item.level >= 4 && styles.tocTextH4,
                                                                    ]}
                                                                >
                                                                    {item.text}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Section 2: Connections Map */}
                        {(hasForward || hasBack) && (
                            <View style={{ marginBottom: 4 }}>
                                <TouchableOpacity
                                    onPress={() => setConnectionsExpanded(!connectionsExpanded)}
                                    style={styles.accordionHeader}
                                >
                                    <View style={styles.accordionHeaderLeft}>
                                        <Ionicons name="git-network-outline" size={14} color={colors.primary} />
                                        <Text style={[styles.accordionTitle, { color: colors.text }]}>CONNECTIONS MAP</Text>
                                    </View>
                                    <Ionicons
                                        name={connectionsExpanded ? "chevron-down" : "chevron-forward"}
                                        size={16}
                                        color={colors.text + '40'}
                                    />
                                </TouchableOpacity>

                                {connectionsExpanded && (
                                    <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                                        <NoteConnectionsGraph
                                            noteId={noteId}
                                            backlinks={backlinks}
                                            forwardLinks={forwardLinks}
                                            onClose={onClose}
                                        />
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Section 3: Stats & Metadata */}
                        <View style={{ marginBottom: 4 }}>
                            <TouchableOpacity
                                onPress={() => setStatsExpanded(!statsExpanded)}
                                style={styles.accordionHeader}
                            >
                                <View style={styles.accordionHeaderLeft}>
                                    <Ionicons name="stats-chart-outline" size={14} color={colors.primary} />
                                    <Text style={[styles.accordionTitle, { color: colors.text }]}>STATS & METADATA</Text>
                                </View>
                                <Ionicons
                                    name={statsExpanded ? "chevron-down" : "chevron-forward"}
                                    size={16}
                                    color={colors.text + '40'}
                                />
                            </TouchableOpacity>

                            {statsExpanded && (
                                <View style={styles.accordionContent}>
                                    <View style={styles.metadataContainer}>
                                        {/* Words */}
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaLabelContainer}>
                                                <Ionicons name="language-outline" size={16} color={colors.text + '50'} />
                                                <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>WORDS</Text>
                                            </View>
                                            <View style={styles.metaValueContainer}>
                                                <Text style={[styles.metaDate, { color: colors.text + '80' }]}>{stats.words}</Text>
                                            </View>
                                        </View>

                                        {/* Chars */}
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaLabelContainer}>
                                                <Ionicons name="text-outline" size={16} color={colors.text + '50'} />
                                                <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>CHARACTERS</Text>
                                            </View>
                                            <View style={styles.metaValueContainer}>
                                                <Text style={[styles.metaDate, { color: colors.text + '80' }]}>{stats.chars}</Text>
                                            </View>
                                        </View>

                                        {/* Size */}
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaLabelContainer}>
                                                <Ionicons name="save-outline" size={16} color={colors.text + '50'} />
                                                <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>SIZE</Text>
                                            </View>
                                            <View style={styles.metaValueContainer}>
                                                <Text style={[styles.metaDate, { color: colors.text + '80' }]}>{formatSize(stats.size)}</Text>
                                            </View>
                                        </View>

                                        {/* Created */}
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaLabelContainer}>
                                                <Ionicons name="calendar-outline" size={16} color={colors.text + '50'} />
                                                <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>CREATED</Text>
                                            </View>
                                            <View style={styles.metaValueContainer}>
                                                <Text style={[styles.metaTime, { color: colors.text + '40' }]}>
                                                    {format(new Date(note.createdAt), "HH:mm")}
                                                </Text>
                                                <Text style={[styles.metaDate, { color: colors.text + '80' }]}>
                                                    {format(new Date(note.createdAt), "MMM d, yyyy")}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Updated */}
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaLabelContainer}>
                                                <Ionicons name="time-outline" size={16} color={colors.text + '50'} />
                                                <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>UPDATED</Text>
                                            </View>
                                            <View style={styles.metaValueContainer}>
                                                <Text style={[styles.metaTime, { color: colors.text + '40' }]}>
                                                    {format(new Date(note.updatedAt), "HH:mm")}
                                                </Text>
                                                <Text style={[styles.metaDate, { color: colors.text + '80' }]}>
                                                    {format(new Date(note.updatedAt), "MMM d, yyyy")}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeButton: {
        padding: 4,
    },
    mainContent: {
        flex: 1,
    },
    scrollArea: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    emptyContainer: {
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
    },
    emptyText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    tocContainer: {
        gap: 2,
    },
    tocItem: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    tocPrefix: {
        fontFamily: 'monospace',
        fontSize: 11,
    },
    tocTextButton: {
        flex: 1,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    tocText: {
        fontSize: 12,
        flex: 1,
    },
    tocTextH1: {
        fontSize: 13,
        fontWeight: '700',
    },
    tocTextH2: {
        fontSize: 12,
        fontWeight: '600',
    },
    tocTextH3: {
        fontSize: 11,
        fontWeight: '500',
    },
    tocTextH4: {
        fontSize: 11,
        fontWeight: '400',
    },
    footer: {

        paddingHorizontal: 20,
        gap: 24,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        flex: 1,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '700',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    metadataContainer: {
        gap: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    metaLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    metaValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaDate: {
        fontSize: 13,
        fontWeight: '700',
    },
    metaTime: {
        fontSize: 13,
        fontWeight: '500',
    },
    linksContainer: {
        gap: 8,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 8,
    },
    linkText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    linksCard: {
        marginHorizontal: 20,
        marginVertical: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    twoColContainer: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    oneColContainer: {
        flexDirection: 'column',
    },
    col: {
        flex: 1,
    },
    colHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
        paddingHorizontal: 4,
    },
    colTitle: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    colScroll: {
        maxHeight: 98,
    },
    colList: {
        gap: 4,
    },
    colDivider: {
        width: 1,
        marginHorizontal: 12,
        alignSelf: 'stretch',
    },
    mobileLinkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        paddingHorizontal: 6,
        borderRadius: 6,
        gap: 8,
        height: 30,
    },
    mobileLinkText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    mobileLinkIcon: {
        opacity: 0.7,
    },
    mapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    mapTitle: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    mapContainer: {
        alignItems: 'center',
        width: '100%',
        gap: 2,
    },
    mapPillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        paddingVertical: 2,
    },
    mapPill: {
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
        maxWidth: 130,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapPillText: {
        fontSize: 10,
        fontWeight: '500',
    },
    mapConnector: {
        alignItems: 'center',
        height: 18,
        justifyContent: 'center',
    },
    mapLine: {
        width: 1,
        height: 10,
    },
    mapArrowhead: {
        marginTop: -3,
    },
    mapCurrentPill: {
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 14,
        maxWidth: 220,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapCurrentText: {
        fontSize: 11,
        fontWeight: '700',
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    accordionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    accordionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    accordionContent: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
});
