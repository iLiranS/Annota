import { ImageGallery } from '@/components/editor-ui/image-gallery';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { getPaginatedMedia, resolveLocalUri, type MediaItem } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as RN from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = RN.Dimensions.get('window').width;
const COLUMN_COUNT = SCREEN_WIDTH > 600 ? 4 : 3;
const ITEM_SIZE = (SCREEN_WIDTH - 32 - (COLUMN_COUNT - 1) * 8) / COLUMN_COUNT;

export default function MediaLibraryScreen() {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [items, setItems] = useState<MediaItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedImage, setSelectedImage] = useState<{ src: string } | null>(null);
    const [selectedItemForNotes, setSelectedItemForNotes] = useState<MediaItem | null>(null);

    const pageRef = useRef(1);
    const loadingRef = useRef(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchMedia = useCallback(async (pageNum: number, search: string, append: boolean = true) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const result = await getPaginatedMedia(pageNum, 30, search);
            if (append) {
                setItems(prev => [...prev, ...result.items]);
            } else {
                setItems(result.items);
            }
            setTotalCount(result.totalCount);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error('Failed to fetch media:', error);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            pageRef.current = 1;
            setHasMore(true);
            fetchMedia(1, searchQuery, false);
        }, 300);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, fetchMedia]);

    const handleLoadMore = () => {
        if (hasMore && !loadingRef.current) {
            pageRef.current += 1;
            fetchMedia(pageRef.current, searchQuery, true);
        }
    };

    const renderItem = ({ item }: { item: MediaItem }) => (
        <MediaCard 
            item={item} 
            colors={colors} 
            onPressImage={(src) => setSelectedImage({ src })}
            onLongPress={() => setSelectedItemForNotes(item)}
        />
    );

    return (
        <RN.View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Media Library' }} />
            
            <RN.View style={[styles.header, { borderBottomColor: colors.border }]}>
                <RN.View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search" size={18} color={colors.text + '60'} />
                    <RN.TextInput
                        placeholder="Search media..."
                        placeholderTextColor={colors.text + '60'}
                        style={[styles.searchInput, { color: colors.text }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                </RN.View>
                <RN.View style={styles.statsRow}>
                    {totalCount > 0 && (
                        <RN.Text style={[styles.statsText, { color: colors.text + '60' }]}>
                            {totalCount} items found
                        </RN.Text>
                    )}
                    <RN.Text style={[styles.hintText, { color: colors.primary + '80' }]}>
                        Long press for sources
                    </RN.Text>
                </RN.View>
            </RN.View>

            <RN.FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    loading ? (
                        <RN.ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
                    ) : null
                )}
                ListEmptyComponent={() => (
                    !loading ? (
                        <RN.View style={styles.emptyContainer}>
                            <Ionicons name="images-outline" size={48} color={colors.text + '20'} />
                            <RN.Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                                No media found
                            </RN.Text>
                        </RN.View>
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
                    router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
                }}
            />
        </RN.View>
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
    if (!item) return null;

    return (
        <RN.Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <HapticPressable 
                style={styles.modalOverlay}
                onPress={onClose}
            >
                <RN.View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <RN.View style={styles.modalHeader}>
                        <RN.Text style={[styles.modalTitle, { color: colors.text }]}>Associated Notes</RN.Text>
                        <HapticPressable onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </HapticPressable>
                    </RN.View>
                    
                    <RN.ScrollView style={styles.modalScroll}>
                        {item.notes.length === 0 ? (
                            <RN.View style={styles.emptyNotes}>
                                <Ionicons name="trash-outline" size={32} color={colors.text + '20'} />
                                <RN.Text style={[styles.emptyNotesText, { color: colors.text + '40' }]}>
                                    This file is orphaned (not used in any notes)
                                </RN.Text>
                            </RN.View>
                        ) : (
                            item.notes.map((note) => (
                                <HapticPressable
                                    key={note.noteId}
                                    onPress={() => onPressNote(note.noteId)}
                                    style={[styles.noteItem, { borderBottomColor: colors.border + '40' }]}
                                >
                                    <RN.View style={styles.noteItemLeft}>
                                        <Ionicons 
                                            name={note.isLatest ? "document-text" : "time"} 
                                            size={20} 
                                            color={note.isLatest ? colors.primary : colors.text + '40'} 
                                        />
                                        <RN.Text style={[styles.noteItemTitle, { color: colors.text }]}>
                                            {note.noteTitle}
                                        </RN.Text>
                                    </RN.View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.text + '20'} />
                                </HapticPressable>
                            ))
                        )}
                    </RN.ScrollView>
                </RN.View>
            </HapticPressable>
        </RN.Modal>
    );
}

function MediaCard({ 
    item, 
    colors, 
    onPressImage,
    onLongPress
}: { 
    item: MediaItem, 
    colors: any, 
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
            await RN.Share.share({
                url: RN.Platform.OS === 'ios' ? resolvedUri : `file://${resolvedUri}`,
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
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
            <RN.View style={styles.previewContainer}>
                {item.fileType === 'image' && resolvedUri ? (
                    <Image
                        source={{ uri: resolvedUri }}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                    />
                ) : item.fileType === 'image' ? (
                    <RN.ActivityIndicator color={colors.primary} size="small" />
                ) : (
                    <RN.View style={styles.pdfContainer}>
                        <Ionicons name="document-text" size={32} color={colors.primary} />
                        <RN.Text style={[styles.pdfText, { color: colors.primary }]}>PDF</RN.Text>
                    </RN.View>
                )}

                {isHistoryOnly && (
                    <RN.View style={styles.historyBadge}>
                        <Ionicons name="time-outline" size={10} color="#fff" />
                    </RN.View>
                )}
            </RN.View>
        </HapticPressable>
    );
}

const styles = RN.StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        borderBottomWidth: RN.StyleSheet.hairlineWidth,
        gap: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        padding: 0,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    statsText: {
        fontSize: 12,
        fontWeight: '500',
    },
    hintText: {
        fontSize: 11,
        fontWeight: '600',
        fontStyle: 'italic',
    },
    listContent: {
        padding: 12,
        gap: 8,
    },
    card: {
        width: ITEM_SIZE,
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
    historyBadgeText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
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
        ...RN.Platform.select({
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
        borderBottomWidth: RN.StyleSheet.hairlineWidth,
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
});
