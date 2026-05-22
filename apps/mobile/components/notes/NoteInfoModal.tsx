import { calculateNoteStats, useNotesStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { format } from 'date-fns';
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
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [forwardLinks, setForwardLinks] = useState<any[]>([]);
    const [backlinks, setBacklinks] = useState<any[]>([]);

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

    const toggleCollapse = (id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isVisible = (index: number) => {
        let currentLevel = toc[index].level;
        for (let i = index - 1; i >= 0; i--) {
            const prevItem = toc[i];
            if (prevItem.level < currentLevel) {
                if (collapsedIds.has(prevItem.id)) {
                    return false;
                }
                currentLevel = prevItem.level;
            }
        }
        return true;
    };

    const hasChildren = (index: number) => {
        const currentLevel = toc[index].level;
        return index + 1 < toc.length && toc[index + 1].level > currentLevel;
    };

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
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Note Info</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.text + '60'} />
                    </TouchableOpacity>
                </View>

                <View style={styles.mainContent}>
                    {/* Top: Scrollable TOC */}
                    <ScrollView style={styles.scrollArea}>
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.text + '60' }]}>TABLE OF CONTENTS</Text>
                            {toc.length === 0 ? (
                                <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={[styles.emptyText, { color: colors.text + '40' }]}>No headers found</Text>
                                </View>
                            ) : (
                                <View style={styles.tocContainer}>
                                    {toc.map((item, idx) => {
                                        if (!isVisible(idx)) return null;
                                        const itemHasChildren = hasChildren(idx);
                                        const isCollapsed = collapsedIds.has(item.id);

                                        return (
                                            <View
                                                key={`${item.id}-${idx}`}
                                                style={[
                                                    styles.tocItem,
                                                    { marginLeft: (item.level - 1) * 16 }
                                                ]}
                                            >
                                                <TouchableOpacity
                                                    onPress={() => toggleCollapse(item.id)}
                                                    style={[styles.collapseButton, !itemHasChildren && { opacity: 0 }]}
                                                    disabled={!itemHasChildren}
                                                >
                                                    <Ionicons
                                                        name={isCollapsed ? "chevron-forward" : "chevron-down"}
                                                        size={14}
                                                        color={colors.primary + '40'}
                                                    />
                                                </TouchableOpacity>
                                                <Pressable
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
                                                        <Text
                                                            numberOfLines={1}
                                                            style={[
                                                                styles.tocText,
                                                                { color: pressed ? colors.primary : colors.text + '80' },
                                                                item.level === 1 && styles.tocTextH1,
                                                                item.level === 2 && styles.tocTextH2,
                                                            ]}
                                                        >
                                                            {item.text}
                                                        </Text>
                                                    )}
                                                </Pressable>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                    </ScrollView>

                    {/* Forward and Back Links */}
                    {hasForward || hasBack ? (
                        <View style={[
                            styles.linksCard,
                            {
                                backgroundColor: colors.card + '30',
                                borderColor: colors.border,
                            }
                        ]}>
                            <View style={hasForward && hasBack ? styles.twoColContainer : styles.oneColContainer}>
                                {/* Forward Links Column */}
                                {hasForward && (
                                    <View style={hasForward && hasBack ? styles.col : null}>
                                        <View style={styles.colHeader}>
                                            <Ionicons name="arrow-forward-outline" size={12} color={colors.primary} />
                                            <Text style={[styles.colTitle, { color: colors.text + '60' }]}>FORWARD LINKS</Text>
                                            <Text style={[styles.colTitle, { color: colors.text + '40', fontWeight: '500' }]}>
                                                ({forwardLinks.length})
                                            </Text>
                                        </View>
                                        <ScrollView style={styles.colScroll} nestedScrollEnabled>
                                            <View style={styles.colList}>
                                                {forwardLinks.map((link) => (
                                                    <Pressable
                                                        key={link.id}
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
                                                            styles.mobileLinkItem,
                                                            pressed && { backgroundColor: colors.primary + '30' }
                                                        ]}
                                                    >
                                                        {({ pressed }) => (
                                                            <>
                                                                <Text numberOfLines={1} style={[
                                                                    styles.mobileLinkText,
                                                                    { color: pressed ? colors.primary : colors.text + '90' }
                                                                ]}>
                                                                    {link.title || 'Untitled Note'}
                                                                </Text>
                                                                <Ionicons name="link-outline" size={11} color={colors.primary} style={[styles.mobileLinkIcon, pressed && { opacity: 1 }]} />
                                                            </>
                                                        )}
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Divider if both exist */}
                                {hasForward && hasBack && (
                                    <View style={[styles.colDivider, { backgroundColor: colors.border }]} />
                                )}

                                {/* Backlinks Column */}
                                {hasBack && (
                                    <View style={[hasForward && hasBack ? styles.col : null, hasForward && { paddingLeft: 12 }]}>
                                        <View style={styles.colHeader}>
                                            <Ionicons name="arrow-back-outline" size={12} color={colors.primary} />
                                            <Text style={[styles.colTitle, { color: colors.text + '60' }]}>BACK LINKS</Text>
                                            <Text style={[styles.colTitle, { color: colors.text + '40', fontWeight: '500' }]}>
                                                ({backlinks.length})
                                            </Text>
                                        </View>
                                        <ScrollView style={styles.colScroll} nestedScrollEnabled>
                                            <View style={styles.colList}>
                                                {backlinks.map((link) => (
                                                    <Pressable
                                                        key={link.id}
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
                                                            styles.mobileLinkItem,
                                                            pressed && { backgroundColor: colors.primary + '30' }
                                                        ]}
                                                    >
                                                        {({ pressed }) => (
                                                            <>
                                                                <Text numberOfLines={1} style={[
                                                                    styles.mobileLinkText,
                                                                    { color: pressed ? colors.primary : colors.text + '90' }
                                                                ]}>
                                                                    {link.title || 'Untitled Note'}
                                                                </Text>
                                                                <Ionicons name="link-outline" size={11} color={colors.primary} style={[styles.mobileLinkIcon, pressed && { opacity: 1 }]} />
                                                            </>
                                                        )}
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    ) : null}

                    {/* Bottom: Anchored Stats & Metadata */}
                    <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
                        {/* Stats */}
                        <View style={styles.statsGrid}>
                            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.statHeader}>
                                    <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                                    <Text style={[styles.statLabel, { color: colors.text + '60' }]}>WORDS</Text>
                                </View>
                                <Text style={[styles.statValue, { color: colors.text + "80" }]}>{stats.words}</Text>
                            </View>
                            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.statHeader}>
                                    <Ionicons name="reader-outline" size={14} color={colors.primary} />
                                    <Text style={[styles.statLabel, { color: colors.text + '60' }]}>CHARS</Text>
                                </View>
                                <Text style={[styles.statValue, { color: colors.text + "80" }]}>{stats.chars}</Text>
                            </View>
                            <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.statHeader}>
                                    <Ionicons name="save-outline" size={14} color={colors.primary} />
                                    <Text style={[styles.statLabel, { color: colors.text + '60' }]}>SIZE</Text>
                                </View>
                                <Text style={[styles.statValue, { color: colors.text + "80" }]}>{formatSize(stats.size)}</Text>
                            </View>
                        </View>

                        {/* Metadata */}
                        <View style={styles.metadataContainer}>
                            <View style={styles.metaRow}>
                                <View style={styles.metaLabelContainer}>
                                    <Ionicons name="calendar-outline" size={16} color={colors.primary + '80'} />
                                    <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>CREATED</Text>
                                </View>
                                <View style={styles.metaValueContainer}>
                                    <Text style={[styles.metaDate, { color: colors.text + '80' }]}>
                                        {format(new Date(note.createdAt), "MMM d, yyyy")}
                                    </Text>
                                    <Text style={[styles.metaTime, { color: colors.text + '40' }]}>
                                        {format(new Date(note.createdAt), "HH:mm")}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.metaRow}>
                                <View style={styles.metaLabelContainer}>
                                    <Ionicons name="time-outline" size={16} color={colors.primary + '80'} />
                                    <Text style={[styles.metaLabel, { color: colors.text + '60' }]}>UPDATED</Text>
                                </View>
                                <View style={styles.metaValueContainer}>
                                    <Text style={[styles.metaDate, { color: colors.text + '80' }]}>
                                        {format(new Date(note.updatedAt), "MMM d, yyyy")}
                                    </Text>
                                    <Text style={[styles.metaTime, { color: colors.text + '40' }]}>
                                        {format(new Date(note.updatedAt), "HH:mm")}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
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
        alignItems: 'center',
    },
    collapseButton: {
        padding: 8,
    },
    tocTextButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    tocText: {
        fontSize: 13,
    },
    tocTextH1: {
        fontSize: 15,
        fontWeight: '700',
    },
    tocTextH2: {
        fontSize: 14,
        fontWeight: '600',
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
});
