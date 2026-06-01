import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { MediaCard } from '@/components/notes/media-search-browser';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { MediaItem } from '@annota/core';

interface RecentMediaSectionProps {
    mediaItems: MediaItem[];
    mediaLoading: boolean;
    mediaCardSize: number;
    onPressImage: (src: string) => void;
    onLongPressMedia: (item: MediaItem) => void;
}

export function RecentMediaSection({
    mediaItems,
    mediaLoading,
    mediaCardSize,
    onPressImage,
    onLongPressMedia,
}: RecentMediaSectionProps) {
    const { colors } = useAppTheme();

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderContainer}>
                <Ionicons name="images-outline" size={16} color={colors.text + '80'} />
                <Text style={[styles.sectionTitle, { color: colors.text + '99' }]}>RECENT MEDIA & FILES</Text>
            </View>

            {mediaLoading ? (
                <View style={styles.mediaLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            ) : mediaItems.length === 0 ? (
                <View style={[styles.emptyContainer, { borderColor: colors.border }]}>
                    <Ionicons name="document-attach-outline" size={32} color={colors.text + '20'} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No media assets</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.text + '50' }]}>
                        Images and files attached to notes will appear here.
                    </Text>
                </View>
            ) : (
                <View style={styles.mediaGrid}>
                    {mediaItems.map((item) => (
                        <MediaCard
                            key={item.id}
                            item={item}
                            colors={colors}
                            itemSize={mediaCardSize}
                            onPressImage={onPressImage}
                            onLongPress={() => onLongPressMedia(item)}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        marginBottom: 24,
    },
    sectionHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingLeft: 4,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    mediaLoadingContainer: {
        paddingVertical: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    emptySubtitle: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
});
