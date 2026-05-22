import { ImageGallery } from '@/components/editor-ui/image-gallery';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { getPaginatedMedia, resolveLocalUri, type MediaItem } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useAppTheme } from '../../hooks/use-app-theme';
import { copyFileToClipboardMobile } from '@/utils/clipboard';
import * as Clipboard from 'expo-clipboard';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MediaSearchBrowserProps {
    searchQuery: string;
    topOffset?: number;
    top?: number;
    onClose: () => void;
}

export function MediaSearchBrowser({
    searchQuery,
    topOffset = 0,
    top,
    onClose,
}: MediaSearchBrowserProps) {
    const { colors } = useAppTheme();
    const router = useRouter();
    const isFloating = topOffset > 0;

    // Media states
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(true);
    const [mediaHasMore, setMediaHasMore] = useState(true);
    const [mediaTotalCount, setMediaTotalCount] = useState(0);
    const [selectedImage, setSelectedImage] = useState<{ src: string } | null>(null);
    const [selectedItemForNotes, setSelectedItemForNotes] = useState<MediaItem | null>(null);

    const mediaPageRef = useRef(1);
    const mediaLoadingRef = useRef(false);
    const mediaSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitialMount = useRef(true);

    // Calculate dynamic grid dimensions based on layout type
    const { colCount, itemSize } = React.useMemo(() => {
        const width = SCREEN_WIDTH - (isFloating ? 24 : 0);
        const count = width > 600 ? 4 : 3;
        const size = (width - 32 - (count - 1) * 8) / count;
        return { colCount: count, itemSize: size };
    }, [isFloating]);

    // Fetch media function
    const fetchMedia = useCallback(async (pageNum: number, search: string, append: boolean = true) => {
        if (mediaLoadingRef.current) return;
        mediaLoadingRef.current = true;
        setMediaLoading(true);
        try {
            const result = await getPaginatedMedia(pageNum, 30, search);
            if (append) {
                setMediaItems(prev => [...prev, ...result.items]);
            } else {
                setMediaItems(result.items);
            }
            setMediaTotalCount(result.totalCount);
            setMediaHasMore(result.hasMore);
        } catch (error) {
            console.error('Failed to fetch media:', error);
        } finally {
            mediaLoadingRef.current = false;
            setMediaLoading(false);
        }
    }, []);

    // Fetch media when search query changes
    useEffect(() => {
        if (mediaSearchTimeoutRef.current) clearTimeout(mediaSearchTimeoutRef.current);

        const triggerFetch = () => {
            mediaPageRef.current = 1;
            setMediaHasMore(true);
            fetchMedia(1, searchQuery, false);
        };

        if (isInitialMount.current) {
            isInitialMount.current = false;
            triggerFetch();
        } else {
            setMediaLoading(true);
            mediaSearchTimeoutRef.current = setTimeout(triggerFetch, 300);
        }

        return () => {
            if (mediaSearchTimeoutRef.current) clearTimeout(mediaSearchTimeoutRef.current);
        };
    }, [searchQuery, fetchMedia]);

    const handleLoadMoreMedia = () => {
        if (mediaHasMore && !mediaLoadingRef.current) {
            mediaPageRef.current += 1;
            fetchMedia(mediaPageRef.current, searchQuery, true);
        }
    };

    const renderMediaItem = ({ item }: { item: MediaItem }) => (
        <MediaCard
            item={item}
            colors={colors}
            itemSize={itemSize}
            onPressImage={(src) => setSelectedImage({ src })}
            onLongPress={() => setSelectedItemForNotes(item)}
        />
    );

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    top: top !== undefined ? top + 8 : topOffset + 96,
                },
                isFloating ? {
                    marginHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    bottom: 12,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 5,
                } : {
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTopWidth: 1,
                }
            ]}
        >
            <FlatList
                data={mediaItems}
                renderItem={renderMediaItem}
                keyExtractor={item => item.id}
                numColumns={colCount}
                key={`media-grid-${colCount}`}
                style={{ flex: 1 }}
                contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
                onEndReached={handleLoadMoreMedia}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    mediaLoading ? (
                        <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
                    ) : null
                )}
                ListEmptyComponent={() => (
                    !mediaLoading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="images-outline" size={48} color={colors.text + '20'} />
                            <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                                No media found
                            </Text>
                        </View>
                    ) : null
                )}
            />

            <ImageGallery
                visible={!!selectedImage}
                images={selectedImage ? [{ src: selectedImage.src, width: "0", position: 0 } as any] : []}
                initialIndex={0}
                onClose={() => setSelectedImage(null)}
            />

            <NotesModal
                visible={!!selectedItemForNotes}
                item={selectedItemForNotes}
                colors={colors}
                onClose={() => setSelectedItemForNotes(null)}
                onPressNote={(noteId) => {
                    setSelectedItemForNotes(null);
                    onClose();
                    router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
                }}
            />

            {/* Muted Tip Banner at the Bottom */}
            <View style={[styles.tipBanner, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.text + '40'} />
                <Text style={[styles.tipText, { color: colors.text + '50' }]}>
                    Long-press any media card to view its references
                </Text>
            </View>
        </View>
    );
}

function NotesModal({
    visible,
    item,
    colors,
    onClose,
    onPressNote
}: {
    visible: boolean,
    item: MediaItem | null,
    colors: any,
    onClose: () => void,
    onPressNote: (id: string) => void
}) {
    const [copied, setCopied] = useState(false);

    if (!item) return null;

    const handleCopy = async () => {
        try {
            const resolved = await resolveLocalUri(item.localPath);
            let success = false;
            if (item.fileType === 'image') {
                success = await copyFileToClipboardMobile(resolved, item.id);
            } else {
                await Clipboard.setStringAsync(resolved);
                success = true;
            }
            if (success) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Failed to copy media:', err);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <HapticPressable
                style={styles.modalOverlay}
                onPress={onClose}
            >
                <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>References</Text>
                            <HapticPressable
                                onPress={handleCopy}
                                style={({ pressed }) => [
                                    styles.copyButton,
                                    pressed && { opacity: 0.7 }
                                ]}
                            >
                                <Ionicons
                                    name={copied ? "checkmark-circle" : "copy-outline"}
                                    size={18}
                                    color={copied ? '#10B981' : colors.primary}
                                />
                            </HapticPressable>
                        </View>
                        <HapticPressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </HapticPressable>
                    </View>

                    <ScrollView style={styles.modalScroll}>
                        {item.notes.length === 0 ? (
                            <View style={styles.emptyNotes}>
                                <Ionicons name="trash-outline" size={32} color={colors.text + '20'} />
                                <Text style={[styles.emptyNotesText, { color: colors.text + '40' }]}>
                                    This file is orphaned (not used in any notes)
                                </Text>
                            </View>
                        ) : (
                            item.notes.map((note) => (
                                <HapticPressable
                                    key={note.noteId}
                                    onPress={() => onPressNote(note.noteId)}
                                    style={({ pressed }) => [
                                        styles.noteItem,
                                        { borderBottomColor: colors.border },
                                        pressed && { transform: [{ scale: 0.98 }] }
                                    ]}
                                >
                                    {({ pressed }) => (
                                        <>
                                            <View style={styles.noteItemLeft}>
                                                <Ionicons
                                                    name={note.isLatest ? "document-text" : "time"}
                                                    size={20}
                                                    color={note.isLatest ? colors.primary : (pressed ? colors.text + '30' : colors.text + '40')}
                                                />
                                                <Text style={[
                                                    styles.noteItemTitle,
                                                    { color: pressed ? colors.text + '60' : colors.text }
                                                ]}>
                                                    {note.noteTitle}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={pressed ? colors.text + '10' : colors.text + '20'} />
                                        </>
                                    )}
                                </HapticPressable>
                            ))
                        )}
                    </ScrollView>
                </View>
            </HapticPressable>
        </Modal>
    );
}

function MediaCard({
    item,
    colors,
    itemSize,
    onPressImage,
    onLongPress
}: {
    item: MediaItem,
    colors: any,
    itemSize: number,
    onPressImage: (src: string) => void,
    onLongPress: () => void
}) {
    const [resolvedUri, setResolvedUri] = useState<string | null>(null);

    useEffect(() => {
        resolveLocalUri(item.localPath).then(setResolvedUri);
    }, [item.localPath]);

    const isHistoryOnly = item.notes.length > 0 && item.notes.every(n => !n.isLatest);

    const handlePress = async () => {
        if (!resolvedUri) return;
        if (item.fileType === 'pdf') {
            await Share.share({
                url: Platform.OS === 'ios' ? resolvedUri : `file://${resolvedUri}`,
                title: item.localPath
            });
        } else {
            onPressImage(resolvedUri);
        }
    };

    return (
        <HapticPressable
            onPress={handlePress}
            onLongPress={onLongPress}
            style={[styles.card, { width: itemSize, backgroundColor: colors.card, borderColor: colors.border }]}
        >
            <View style={styles.previewContainer}>
                {item.fileType === 'image' && resolvedUri ? (
                    <Image
                        source={{ uri: resolvedUri }}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                    />
                ) : item.fileType === 'image' ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                    <View style={styles.pdfContainer}>
                        <Ionicons name="document-text" size={32} color={colors.primary} />
                        <Text style={[styles.pdfText, { color: colors.primary }]}>PDF</Text>
                    </View>
                )}

                {isHistoryOnly && (
                    <View style={styles.historyBadge}>
                        <Ionicons name="time-outline" size={10} color="#fff" />
                    </View>
                )}

                {item.notes.length > 0 && (
                    <View style={styles.notesCountBadge}>
                        <Ionicons name="document-text" size={10} color="#fff" />
                        <Text style={styles.notesCountText}>{item.notes.length}</Text>
                    </View>
                )}
            </View>
        </HapticPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 99,
    },
    listContent: {
        padding: 12,
        gap: 8,
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 8,
        marginHorizontal: 4,
    },
    previewContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: 'rgba(0,0,0,0.02)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    pdfContainer: {
        alignItems: 'center',
        gap: 4,
    },
    pdfText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    historyBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: 'rgba(249, 115, 22, 0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    notesCountBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 3,
    },
    notesCountText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        lineHeight: 12,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxHeight: '70%',
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingBottom: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalScroll: {
        padding: 16,
    },
    noteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    noteItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    noteItemTitle: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    emptyNotes: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyNotesText: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.6,
        paddingHorizontal: 20,
    },
    tipBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: 'center',
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 20,
        marginTop: 8,
    },
    tipText: {
        fontSize: 11,
        fontWeight: '500',
    },
    copyButton: {
        padding: 4,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
