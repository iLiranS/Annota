import { ImageGallery } from '@/components/editor-ui/image-gallery';
import { WelcomeBanner } from '@/components/dashboard/welcome-banner';
import { StatsSummaryRow } from '@/components/dashboard/stats-summary-row';
import { WritingActivityHeatmap } from '@/components/dashboard/writing-activity-heatmap';
import { RecentNotesSection } from '@/components/dashboard/recent-notes-section';
import { RecentMediaSection } from '@/components/dashboard/recent-media-section';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { NotesModal } from '@/components/notes/media-search-browser';
import { useSidebar } from '@/context/sidebar-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import AiChatModal from '@/components/ai/AiChatModal';
import {
    DAILY_NOTES_FOLDER_ID,
    getPaginatedMedia,
    useNotesStore,
    useUserStore,
    useSyncStore,
    useSettingsStore,
    type MediaItem,
} from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import { useRouter, Stack } from 'expo-router';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Dimensions,
    StyleSheet,
    View,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Animated from 'react-native-reanimated';
import { usePullToSync } from '@/hooks/use-pull-to-sync';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HomeScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { toggle: toggleSidebar } = useSidebar();

    const { notes, folders, tags, createNote } = useNotesStore();
    const { session, displayName, isGuest } = useUserStore();
    const isAiEnabled = useSettingsStore((state) => state.general.isAiEnabled);

    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<{ src: string } | null>(null);
    const [selectedItemForNotes, setSelectedItemForNotes] = useState<MediaItem | null>(null);
    const [aiModalVisible, setAiModalVisible] = useState(false);

    // Calculate dynamic media card size
    const mediaCardSize = useMemo(() => {
        // Horizontal spacing: 20px padding left + 20px padding right = 40px screen edge offset.
        // Item spacing: 8px gap
        return (SCREEN_WIDTH - 40 - 16) / 3;
    }, []);

    // Fetch recent media files
    const loadMedia = useCallback(async () => {
        try {
            const res = await getPaginatedMedia(1, 6, "");
            setMediaItems(res.items);
        } catch (err) {
            console.error("[Home] Failed to load media:", err);
        } finally {
            setMediaLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMedia();
    }, [loadMedia]);

    // Use custom pull-to-refresh force sync hook
    const { scrollHandler, spinnerStyle } = usePullToSync({
        onRefresh: loadMedia,
        top: insets.top + 12,
    });

    // Time-based greeting greeting text
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    // Guest name or user display name
    const name = useMemo(() => {
        if (session) return displayName || "User";
        return isGuest ? "Guest" : "User";
    }, [session, displayName, isGuest]);

    // Statistics selectors - Fix: Filter out system folders (!f.isSystem)
    const stats = useMemo(() => {
        const activeNotes = notes.filter((n) => !n.isDeleted);
        const activeFolders = folders.filter((f) => !f.isDeleted && !f.isSystem);
        return {
            notesCount: activeNotes.length,
            foldersCount: activeFolders.length,
            tagsCount: tags.length,
        };
    }, [notes, folders, tags]);

    // Top 4 recently updated active notes
    const recentNotes = useMemo(() => {
        return [...notes]
            .filter((n) => !n.isDeleted)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 4);
    }, [notes]);

    // Writing streak and monthly heatmap calculations
    const streakData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();

        const dayNotesMap = new Map<number, Set<string>>();
        notes.forEach(note => {
            if (note.isDeleted) return;
            const cDate = new Date(note.createdAt);
            const uDate = new Date(note.updatedAt);

            const addActivity = (dayNum: number, noteId: string) => {
                if (!dayNotesMap.has(dayNum)) {
                    dayNotesMap.set(dayNum, new Set());
                }
                dayNotesMap.get(dayNum)!.add(noteId);
            };

            if (cDate.getFullYear() === year && cDate.getMonth() === month) {
                addActivity(cDate.getDate(), note.id);
            }
            if (uDate.getFullYear() === year && uDate.getMonth() === month) {
                addActivity(uDate.getDate(), note.id);
            }
        });

        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const count = dayNotesMap.get(dayNum)?.size || 0;
            return {
                day: dayNum,
                count,
                isActive: count > 0,
                date: new Date(year, month, dayNum),
            };
        });

        const noteDates = new Set<string>();
        notes.forEach(n => {
            if (n.isDeleted) return;
            noteDates.add(format(new Date(n.createdAt), "yyyy-MM-dd"));
            noteDates.add(format(new Date(n.updatedAt), "yyyy-MM-dd"));
        });

        const todayStr = format(new Date(), "yyyy-MM-dd");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, "yyyy-MM-dd");

        const hasActivityToday = noteDates.has(todayStr);
        const hasActivityYesterday = noteDates.has(yesterdayStr);

        let streak = 0;
        if (hasActivityToday || hasActivityYesterday) {
            let curr = hasActivityToday ? new Date() : yesterday;
            while (true) {
                const dateStr = format(curr, "yyyy-MM-dd");
                if (noteDates.has(dateStr)) {
                    streak++;
                    curr.setDate(curr.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        return {
            days,
            firstDayOfWeek,
            streak,
            totalActiveDays: dayNotesMap.size,
        };
    }, [notes]);

    // Action creators
    const handleNewNote = async () => {
        const { data: newNote, error } = await createNote({ folderId: '' });
        if (error) {
            Toast.show({ type: 'error', text1: 'Failed to create note', text2: error });
            return;
        }
        if (newNote) {
            router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'home' } });
        }
    };

    const handleDailyNote = async () => {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const existing = notes.find(
            (n) =>
                n.folderId === DAILY_NOTES_FOLDER_ID &&
                !n.isDeleted &&
                format(new Date(n.createdAt), "yyyy-MM-dd") === todayStr
        );

        if (existing) {
            router.push({ pathname: '/Notes/[id]', params: { id: existing.id, source: 'home' } });
        } else {
            const { data: newNote, error } = await createNote({ folderId: DAILY_NOTES_FOLDER_ID });
            if (error) {
                Toast.show({ type: 'error', text1: 'Failed to create daily note', text2: error });
                return;
            }
            if (newNote) {
                router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'home' } });
            }
        }
    };

    const handleNotePress = useCallback((noteId: string) => {
        router.push({ pathname: '/Notes/[id]', params: { id: noteId, source: 'home' } });
    }, [router]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Animated.View style={spinnerStyle}>
                <View style={[styles.spinnerContainer, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            </Animated.View>
            {/* Simple Transparent Header with Top-Left Menu Button */}
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTransparent: true,
                    headerTitle: '',
                    headerLeft: () => (
                        <HapticPressable
                            onPress={toggleSidebar}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons name="menu" size={24} color={colors.primary} />
                        </HapticPressable>
                    ),
                    headerRight: isAiEnabled ? () => (
                        <HapticPressable
                            onPress={() => setAiModalVisible(true)}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons name="sparkles" size={22} color={colors.primary} />
                        </HapticPressable>
                    ) : undefined,
                }}
            />

            {/* Scrollable Container flowing underneath transparent header */}
            <Animated.ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 52 }]}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                {/* 1. Welcome Banner Card */}
                <WelcomeBanner
                    greeting={greeting}
                    name={name}
                    onNewNote={handleNewNote}
                    onDailyNote={handleDailyNote}
                />

                {/* 2. Stats Grid Summary */}
                <StatsSummaryRow
                    notesCount={stats.notesCount}
                    foldersCount={stats.foldersCount}
                    tagsCount={stats.tagsCount}
                />

                {/* 3. Recently Updated Notes Section */}
                <RecentNotesSection
                    recentNotes={recentNotes}
                    onNotePress={handleNotePress}
                />

                {/* 4. Row-Based Heatmap Writing Activity */}
                <WritingActivityHeatmap
                    days={streakData.days}
                />

                {/* 5. Recent Media & Files Section */}
                <RecentMediaSection
                    mediaItems={mediaItems}
                    mediaLoading={mediaLoading}
                    mediaCardSize={mediaCardSize}
                    onPressImage={(src) => setSelectedImage({ src })}
                    onLongPressMedia={(item) => setSelectedItemForNotes(item)}
                />

                {/* Spacing bottom */}
                <View style={{ height: 40 }} />
            </Animated.ScrollView>

            {/* Image Preview Overlay */}
            <ImageGallery
                visible={!!selectedImage}
                images={selectedImage ? [{ src: selectedImage.src, width: "0", position: 0 } as any] : []}
                initialIndex={0}
                onClose={() => setSelectedImage(null)}
            />

            {/* References bottom references modal */}
            <NotesModal
                visible={!!selectedItemForNotes}
                item={selectedItemForNotes}
                colors={colors}
                onClose={() => setSelectedItemForNotes(null)}
                onPressNote={(noteId) => {
                    setSelectedItemForNotes(null);
                    router.push({ pathname: '/Notes/[id]', params: { id: noteId, source: 'home' } });
                }}
            />

            <AiChatModal
                visible={aiModalVisible}
                onClose={() => setAiModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    spinnerContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
        }),
    },
});
