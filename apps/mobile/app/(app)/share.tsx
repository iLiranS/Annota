import { useAppTheme } from '@/hooks/use-app-theme';
import { parseWebContent } from '@/utils/parse-web-content';
import { generateTitle } from '@annota/core';
import { useNotesStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type ParseState =
    | { status: 'fetching' }
    | { status: 'ready'; contentHtml: string; excerpt: string; siteName: string; byline: string }
    | { status: 'failed'; reason: string };

/**
 * Share pre-save screen.
 *
 * The user lands here after tapping "Annota" in the system share sheet.
 * Content is fetched and parsed in the background while the user can
 * optionally edit the note title. "Save Now" is always available — if
 * parsing hasn't finished the note is created with a URL-only body.
 */
export default function ShareScreen() {
    const { url, title: rawTitle } = useLocalSearchParams<{ url: string; title?: string }>();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { createNote, updateNoteContent } = useNotesStore();

    const [title, setTitle] = useState((rawTitle ?? '').slice(0, 50));
    const [parseState, setParseState] = useState<ParseState>({ status: 'fetching' });
    const [isSaving, setIsSaving] = useState(false);

    // Keep a ref so the save handler always sees the latest parsed state
    // without needing it in its dependency array.
    const parseStateRef = useRef<ParseState>(parseState);
    useEffect(() => {
        parseStateRef.current = parseState;
    }, [parseState]);

    // Hostname for the subtitle — derived from the URL
    const displayHost = (() => {
        try {
            return new URL(url ?? '').hostname;
        } catch {
            return url ?? '';
        }
    })();

    // Start background content fetch on mount
    useEffect(() => {
        if (!url) {
            setParseState({ status: 'failed', reason: 'No URL provided' });
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                const parsed = await parseWebContent(url);
                if (cancelled) return;

                // Use the article title only if the user hasn't typed anything yet
                if (!cancelled && !rawTitle && parsed.title) {
                    setTitle(parsed.title.slice(0, 50));
                }

                setParseState({
                    status: 'ready',
                    contentHtml: parsed.contentHtml,
                    excerpt: parsed.excerpt,
                    siteName: parsed.siteName,
                    byline: parsed.byline,
                });
            } catch (err) {
                if (!cancelled) {
                    console.error('[ShareScreen] parseWebContent failed for url:', url, err);
                    const reason =
                        err instanceof Error ? err.message : 'Unknown error';
                    setParseState({ status: 'failed', reason });
                    Toast.show({
                        type: 'error',
                        text1: 'Failed to parse page content',
                        text2: reason,
                    });
                }
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    /**
     * Builds the note HTML content.
     *
     * Structure:
     *   <blockquote>Source attribution</blockquote>
     *   <p>Author line (if available)</p>
     *   [article body HTML from Readability — or empty if URL-only]
     */
    const buildNoteContent = useCallback(
        (state: ParseState): string => {
            const siteName =
                state.status === 'ready' && state.siteName
                    ? state.siteName
                    : displayHost;

            const sourceBlock = `<blockquote><p>Source: <a href="${url}">${siteName}</a></p></blockquote>`;

            if (state.status !== 'ready') {
                // URL-only fallback
                return sourceBlock;
            }

            const bylineLine =
                state.byline
                    ? `<p><em>By ${state.byline}</em></p>`
                    : '';

            return [sourceBlock, bylineLine, state.contentHtml]
                .filter(Boolean)
                .join('\n');
        },
        [url, displayHost],
    );

    const handleSave = useCallback(async () => {
        if (!url) {
            Alert.alert('Error', 'No URL to save.');
            return;
        }
        setIsSaving(true);

        try {
            const currentState = parseStateRef.current;
            const noteTitle = (title.trim() || generateTitle(buildNoteContent(currentState)) || 'Saved Web Page').slice(0, 50).trim();
            const content = buildNoteContent(currentState);

            const { data: newNote, error } = await createNote({ folderId: null, title: noteTitle });

            if (error || !newNote) {
                throw new Error(error ?? 'Failed to create note');
            }

            // Write content separately (mirrors how the rest of the app works)
            const { error: contentError } = await updateNoteContent(newNote.id, content);
            if (contentError) {
                // Non-fatal: note exists, just content failed — still navigate
                console.warn('[ShareScreen] Content update failed:', contentError);
            }

            Toast.show({
                type: 'success',
                text1: 'Saved to Annota',
                text2: noteTitle,
            });

            // Navigate to the newly created note
            router.replace({
                pathname: '/Notes/[id]',
                params: { id: newNote.id, source: 'share' },
            });
        } catch (err) {
            console.error('[ShareScreen] Save failed:', err);
            Toast.show({
                type: 'error',
                text1: 'Could not save note',
                text2: err instanceof Error ? err.message : 'Unknown error',
            });
            setIsSaving(false);
        }
    }, [url, title, buildNoteContent, createNote, updateNoteContent, router]);

    const handleCancel = useCallback(() => {
        if (router.canDismiss()) {
            router.dismiss();
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(app)');
        }
    }, [router]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Drag indicator (iOS modal style) */}
            <View style={styles.dragIndicatorWrap}>
                <View style={[styles.dragIndicator, { backgroundColor: colors.border }]} />
            </View>

            <View
                style={[
                    styles.content,
                    { paddingBottom: insets.bottom + 16 },
                ]}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconWrap}>
                        <Ionicons name="bookmark" size={22} color={colors.primary} />
                    </View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Save to Annota
                    </Text>
                </View>

                {/* URL chip */}
                <View style={[styles.urlChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="link-outline" size={14} color={colors.text + '80'} />
                    <Text
                        style={[styles.urlText, { color: colors.text + '80' }]}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                    >
                        {displayHost}
                    </Text>
                </View>

                {/* Title field */}
                <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.text + '80' }]}>
                        Title
                    </Text>
                    <TextInput
                        style={[
                            styles.titleInput,
                            {
                                color: colors.text,
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Note title"
                        placeholderTextColor={colors.text + '40'}
                        returnKeyType="done"
                        autoCorrect={false}
                        maxLength={50}
                    />
                </View>

                {/* Parse status badge */}
                <ParseStatusBadge state={parseState} colors={colors} />

                {/* Action buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: colors.border }]}
                        onPress={handleCancel}
                        disabled={isSaving}
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                        onPress={handleSave}
                        disabled={isSaving}
                        accessibilityLabel="Save note"
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.saveText}>Save Now</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// ─── Parse status sub-component ──────────────────────────────────────────────

interface ParseStatusBadgeProps {
    state: ParseState;
    colors: ReturnType<typeof useAppTheme>['colors'];
}

function ParseStatusBadge({ state, colors }: ParseStatusBadgeProps) {
    if (state.status === 'fetching') {
        return (
            <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.text + '80' }]}>
                    Fetching content…
                </Text>
            </View>
        );
    }

    if (state.status === 'ready') {
        return (
            <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={[styles.statusText, { color: '#10b981' }]}>
                    Content ready
                    {state.excerpt ? ` · ${state.excerpt.slice(0, 60)}…` : ''}
                </Text>
            </View>
        );
    }

    // failed
    return (
        <View style={styles.statusRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.text + '60'} />
            <Text style={[styles.statusText, { color: colors.text + '60' }]} numberOfLines={2}>
                Couldn't fetch content ({state.reason}) — URL only will be saved
            </Text>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dragIndicatorWrap: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    dragIndicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        opacity: 0.4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    urlChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    urlText: {
        fontSize: 13,
        flex: 1,
    },
    fieldGroup: {
        gap: 6,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    titleInput: {
        fontSize: 15,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 22,
    },
    statusText: {
        fontSize: 13,
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 'auto',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '500',
    },
    saveButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
