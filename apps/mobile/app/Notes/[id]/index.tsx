import { ImageGallery } from '@/components/editor-ui/image-gallery';
import { NoteTags } from '@/components/editor-ui/note-tags';
import { SlashCommandMenu } from '@/components/editor-ui/slash-command-menu';
import { TagCommandMenu } from '@/components/editor-ui/tag-command-menu';
import { NoteLinkCommandMenu } from '@/components/editor-ui/note-link-command-menu';
import { EditorToolbar } from '@/components/editor-ui/toolbar';
import NoteHeaderMenu from '@/components/notes/note-header-menu';
import { SearchOverlay } from '@/components/notes/search-overlay';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { generateTitle, useNotesStore, useSettingsStore } from '@annota/core';
import TipTapEditor, { TipTapEditorRef, ToolbarRenderProps } from '@annota/tiptap-editor';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import * as ExpoClipboard from 'expo-clipboard';
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Extracts title from HTML content.
 * - Title: First non-empty text content (first line)
 */


export default function NoteEditor() {
    const { id, source, scrollToElementId } = useLocalSearchParams<{ id: string, source: string, scrollToElementId?: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const editorRef = useRef<TipTapEditorRef>(null);
    const { general, editor } = useSettingsStore();



    const { getNoteById, updateNoteMetadata, getNoteContent, updateNoteContent, deleteNote } = useNotesStore();
    const currentNote = id ? getNoteById(id) : undefined;

    // Lazy-loaded content state
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(() => Boolean(id));

    // Track the current title for the header (updates as user types)
    const [displayTitle, setDisplayTitle] = useState(currentNote?.title || 'Untitled Note');

    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResultCount, setSearchResultCount] = useState(0);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

    // Gallery visibility — hide header when gallery is open
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    // Slash commands state
    const [slashCommandState, setSlashCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number } }>({ active: false });
    const [tagCommandState, setTagCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number } }>({ active: false });
    const [noteLinkCommandState, setNoteLinkCommandState] = useState<{ active: boolean; query?: string; range?: { from: number; to: number } }>({ active: false });

    const appliedTagIds = useMemo(() => {
        if (!currentNote || !currentNote.tags) return [];
        try { return JSON.parse(currentNote.tags) as string[]; } catch { return []; }
    }, [currentNote?.tags]);



    const pendingScrollElementIdRef = useRef<string | null>(null);
    const shouldAutofocus = source === 'new' && (!content || content === '<p></p>');

    // Load content from database on mount
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (id) {
                try {
                    const loadedContent = await getNoteContent(id);
                    if (cancelled) return;
                    setContent(loadedContent);
                } catch (error) {
                    if (!cancelled) {
                        console.error('Failed to load note content', error);
                        setContent('');
                    }
                } finally {
                    if (!cancelled) {
                        setIsLoading(false);
                        pendingScrollElementIdRef.current = scrollToElementId ?? null;
                    }
                }
            } else {
                if (!cancelled) {
                    setContent(null);
                    setIsLoading(false);
                    pendingScrollElementIdRef.current = null;
                }
            }
        };

        setIsLoading(Boolean(id));
        void load();

        return () => {
            cancelled = true;
        };
    }, [id, getNoteContent, scrollToElementId]);

    useEffect(() => {
        if (isLoading || !pendingScrollElementIdRef.current) return;

        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 60; // ~1s at 60fps

        const tryScroll = () => {
            if (cancelled || !pendingScrollElementIdRef.current) return;

            const editor = editorRef.current;
            if (editor) {
                editor.scrollToElement(pendingScrollElementIdRef.current);
                pendingScrollElementIdRef.current = null;
                return;
            }

            attempts += 1;
            if (attempts < maxAttempts) {
                requestAnimationFrame(tryScroll);
            } else {
                // Element-specific scroll can't run without editor; drop back to note top behavior.
                pendingScrollElementIdRef.current = null;
            }
        };

        requestAnimationFrame(tryScroll);
        return () => {
            cancelled = true;
        };
    }, [isLoading]);

    // Disable drawer swipe gesture when editor is open
    useFocusEffect(
        useCallback(() => {
            // Find parent drawer navigator and disable swipe
            navigation.getParent()?.setOptions({ swipeEnabled: false });

            return () => {
                // Re-enable swipe when leaving
                navigation.getParent()?.setOptions({ swipeEnabled: true });
            };
        }, [navigation])
    );

    // Handle content changes from the editor
    const handleContentChange = useCallback((html: string) => {
        if (!id) return;
        // Extract title from the content
        const title = generateTitle(html);

        // Update display title for the header
        setDisplayTitle(title);

        // Update the note content in the database (this also updates preview)
        updateNoteContent(id, html);

        // Update the title in metadata
        updateNoteMetadata(id, { title });
    }, [id, updateNoteMetadata, updateNoteContent]);



    const handleBack = useCallback(() => {
        editorRef.current?.blur();
        router.back();
    }, [router]);

    // Search handlers
    const handleOpenSearch = useCallback(() => {
        setIsSearching(true);
    }, []);

    const handleCloseSearch = useCallback(() => {
        setIsSearching(false);
        setSearchTerm('');
        setSearchResultCount(0);
        setCurrentSearchIndex(-1);
        editorRef.current?.clearSearch();
    }, []);

    const handleSearchTermChange = useCallback((term: string) => {
        setSearchTerm(term);
        if (term.length > 0) {
            editorRef.current?.search(term);
        } else {
            editorRef.current?.clearSearch();
            setSearchResultCount(0);
            setCurrentSearchIndex(-1);
        }
    }, []);

    const handleSearchResults = useCallback((count: number, currentIndex: number) => {
        setSearchResultCount(count);
        setCurrentSearchIndex(currentIndex);
    }, []);

    const handleSearchNext = useCallback(() => {
        editorRef.current?.searchNext();
    }, []);

    const handleSearchPrev = useCallback(() => {
        editorRef.current?.searchPrev();
    }, []);

    const handleVersionHistory = useCallback(() => {
        if (!id) return;
        router.push({ pathname: '/Notes/[id]/history', params: { id } });
    }, [id, router]);

    // Menu handlers
    const handleDelete = useCallback(async () => {
        if (!id) return;
        await deleteNote(id);
        if (source === 'home' && router.canGoBack()) {
            router.back();
        } else if (source === 'home') {
            router.replace('/');
        } else {
            router.back();
        }
    }, [id, deleteNote, router, source]);

    const handleToggleQuickAccess = useCallback((value: boolean) => {
        if (!id) return;
        updateNoteMetadata(id, { isQuickAccess: value });
    }, [id, updateNoteMetadata]);

    const handleTogglePin = useCallback((value: boolean) => {
        if (!id) return;
        updateNoteMetadata(id, { isPinned: value });
    }, [id, updateNoteMetadata]);

    const handleCopyLink = useCallback(async () => {
        if (!id) return;
        const link = `annota://note/${id}`;
        await ExpoClipboard.setStringAsync(link);
        setTimeout(() => {
            Alert.alert('Link Copied!', 'The link to this note has been copied to your clipboard.');
        }, 500);
    }, [id]);

    const handleCopyBlockLink = useCallback(async (elementId: string) => {
        if (!id) return;
        const link = `annota://note/${id}?elementId=${elementId}`;
        await ExpoClipboard.setStringAsync(link);
        setTimeout(() => {
            Alert.alert('Block Link Copied!', 'The link to this specific block has been copied to your clipboard.');
        }, 500);
    }, [id]);


    // Handle case where note doesn't exist
    if (!currentNote) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTitle: 'Note Not Found',
                        headerLeft: () => (
                            <HapticPressable
                                onPress={handleBack}
                                style={[
                                    styles.headerButton,
                                    {
                                        padding: 4,
                                        marginLeft: Platform.OS === 'ios' ? -4 : 0,
                                    }
                                ]}
                                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={28}
                                    color={colors.primary}
                                />
                            </HapticPressable>
                        ),
                        headerBackVisible: false,
                    }}
                />
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.border} />
                    <Text style={[styles.errorText, { color: colors.text }]}>
                        Note not found
                    </Text>
                    <Text style={[styles.errorHint, { color: colors.border }]}>
                        This note may have been deleted
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: !isGalleryOpen,
                    gestureEnabled: true, // Re-enable gesture for better UX, back() will handle it correct now
                    headerTransparent: editor.floatingNoteHeader,
                    headerBackground: editor.floatingNoteHeader ? () => <View style={{ flex: 1, backgroundColor: 'transparent' }} /> : undefined,
                    headerBlurEffect: undefined,
                    headerShadowVisible: !editor.floatingNoteHeader,
                    headerTitle: editor.floatingNoteHeader ? '' : () => (
                        <Text
                            style={[styles.headerTitle, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {displayTitle}
                        </Text>
                    ),
                    headerLeft: () => (
                        <HapticPressable
                            onPress={handleBack}
                            style={[
                                styles.headerButton,
                                {
                                    padding: 4,
                                    marginLeft: Platform.OS === 'ios' ? -4 : 0,
                                }
                            ]}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={28}
                                color={colors.primary}
                            />
                        </HapticPressable>
                    ),
                    headerBackVisible: false,
                    headerRight: () => (
                        <NoteHeaderMenu
                            noteId={id}
                            isPinned={currentNote?.isPinned}
                            isQuickAccess={currentNote?.isQuickAccess}
                            onSearch={handleOpenSearch}
                            onDelete={handleDelete}
                            onTogglePin={handleTogglePin}
                            onToggleQuickAccess={handleToggleQuickAccess}
                            onVersionHistory={handleVersionHistory}
                            onCopyLink={handleCopyLink}
                        />
                    ),
                }}
            />

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <View style={styles.editorWrapper}>
                    {/* Search Overlay - absolutely positioned at top of editor */}
                    <SearchOverlay
                        visible={isSearching}
                        onClose={handleCloseSearch}
                        searchTerm={searchTerm}
                        onSearchTermChange={handleSearchTermChange}
                        resultCount={searchResultCount}
                        currentResultIndex={currentSearchIndex}
                        onNext={handleSearchNext}
                        onPrev={handleSearchPrev}
                        topOffset={editor.floatingNoteHeader ? insets.top + 50 : 0}
                    />

                    <TipTapEditor
                        ref={editorRef}
                        noteId={id}
                        initialContent={content ?? ''}
                        onContentChange={handleContentChange}
                        onSearchResults={handleSearchResults}
                        onSlashCommand={setSlashCommandState}
                        onTagCommand={setTagCommandState}
                        onNoteLinkCommand={setNoteLinkCommandState}
                        contentPaddingTop={0}
                        placeholder="Start typing your note..."
                        autofocus={shouldAutofocus}
                        onGalleryVisibilityChange={setIsGalleryOpen}
                        onCopyBlockLink={handleCopyBlockLink}
                        renderHeader={() => {
                            const hasTags = appliedTagIds.length > 0;
                            const headerOffset = editor.floatingNoteHeader ? insets.top + 44 : 0;
                            return (
                                <View style={{ marginTop: headerOffset, zIndex: 10, marginBottom: -44 }}>
                                    {hasTags && (
                                        <NoteTags
                                            noteId={id}
                                        />
                                    )}
                                </View>
                            );
                        }}
                        renderToolbar={(props: ToolbarRenderProps) => <EditorToolbar {...props} />}
                        renderImageGallery={(props: any) => <ImageGallery {...props} />}
                        renderSlashCommandMenu={() => {
                            if (tagCommandState.active && tagCommandState.range) {
                                return (
                                    <TagCommandMenu
                                        noteId={id}
                                        query={tagCommandState.query || ''}
                                        range={tagCommandState.range}
                                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                                        onClose={() => setTagCommandState({ active: false })}
                                    />
                                );
                            }
                            if (slashCommandState.active && slashCommandState.range) {
                                return (
                                    <SlashCommandMenu
                                        query={slashCommandState.query || ''}
                                        range={slashCommandState.range}
                                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                                        onClose={() => setSlashCommandState({ active: false })}
                                    />
                                );
                            }
                            if (noteLinkCommandState.active && noteLinkCommandState.range) {
                                return (
                                    <NoteLinkCommandMenu
                                        query={noteLinkCommandState.query || ''}
                                        range={noteLinkCommandState.range}
                                        sendCommand={(cmd, params) => editorRef.current?.onCommand(cmd, params)}
                                        onClose={() => setNoteLinkCommandState({ active: false })}
                                    />
                                );
                            }
                            return null;
                        }}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    editorWrapper: {
        flex: 1,

    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        maxWidth: 200,
    },
    headerButton: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 12,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
    },
    errorHint: {
        fontSize: 14,
        textAlign: 'center',
    },
});
