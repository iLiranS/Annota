import AiChatModal from '@/components/ai/AiChatModal';
import { ImageGallery } from '@/components/editor-ui/image-gallery';
import { NoteLinkCommandMenu } from '@/components/editor-ui/note-link-command-menu';
import { NoteTags } from '@/components/editor-ui/note-tags';
import { SlashCommandMenu } from '@/components/editor-ui/slash-command-menu';
import { TagCommandMenu } from '@/components/editor-ui/tag-command-menu';
import { EditorToolbar } from '@/components/editor-ui/toolbar';
import NoteHeaderMenu from '@/components/notes/note-header-menu';
import NoteInfoModal from '@/components/notes/NoteInfoModal';
import { SearchOverlay } from '@/components/notes/search-overlay';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { ContextMode, generateTitle, purifyNoteHtml, useAiChat, useAiStore, useNotesStore, useSettingsStore } from '@annota/core';
import TipTapEditor, { TipTapEditorRef, ToolbarRenderProps } from '@annota/editor-ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@react-navigation/native';
import * as ExpoClipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Platform,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

/**
 * Extracts title from HTML content.
 * - Title: First non-empty text content (first line)
 */


export default function NoteEditor() {
    const { id, source, blockId } = useLocalSearchParams<{ id: string, source: string, blockId?: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const editorRef = useRef<TipTapEditorRef>(null);
    const { general, editor } = useSettingsStore();



    const { updateNoteMetadata, getNoteContent, updateNoteContent, deleteNote, restoreNote } = useNotesStore();
    const currentNote = useNotesStore(useCallback(state => id ? state.notes.find(n => n.id === id) : undefined, [id]));

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
    const [isAiChatVisible, setIsAiChatVisible] = useState(false);
    const [isNoteInfoVisible, setIsNoteInfoVisible] = useState(false);

    const isDeletingRef = useRef(false);
    const isInitialized = useNotesStore(state => state.isInitialized);

    // Track last viewed note
    useEffect(() => {
        if (id) {
            const saveLastViewed = async () => {
                try {
                    await AsyncStorage.setItem('@last_viewed_note_id', id);
                    await AsyncStorage.setItem('@last_viewed_note_at', Date.now().toString());
                } catch (e) {
                    console.error('Failed to save last viewed note', e);
                }
            };
            saveLastViewed();
        }

        return () => {
            const clearLastViewed = async () => {
                try {
                    await AsyncStorage.removeItem('@last_viewed_note_id');
                    await AsyncStorage.removeItem('@last_viewed_note_at');
                } catch (e) {
                    console.error('Failed to clear last viewed note', e);
                }
            };
            clearLastViewed();
        };
    }, [id]);

    // Handle note deletion/sync edge case
    useEffect(() => {
        if (isInitialized && id && !isDeletingRef.current) {
            if (!currentNote || currentNote.isPermDeleted) {
                Toast.show({
                    type: 'info',
                    text1: 'Note no longer available',
                    text2: 'This note was deleted or synced out.',
                });
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/Notes');
                }
            }
        }
    }, [isInitialized, id, currentNote]);

    const handleNoteInfo = useCallback(() => {
        setIsNoteInfoVisible(true);
    }, []);

    const handleScrollToElement = useCallback((elementId: string) => {
        editorRef.current?.scrollToElement(elementId);
    }, []);

    const appliedTagIds = useMemo(() => {
        if (!currentNote || !currentNote.tags) return [];
        try { return JSON.parse(currentNote.tags) as string[]; } catch { return []; }
    }, [currentNote?.tags]);



    const isEmptyContent = (html: string) => {
        const normalized = html
            .replace(/&nbsp;/gi, '')
            .replace(/\s/g, '')
            .toLowerCase();
        return normalized === '' || normalized === '<p></p>' || normalized === '<p><br></p>';
    };

    const shouldAutofocus = content !== null && isEmptyContent(content);
    const isContentReady = !id || content !== null;

    const lastSavedContentRef = useRef<string | null>(null);
    const lastScrolledElementIdRef = useRef<string | null>(null);

    // Load content from database on mount
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (id) {
                try {
                    const loadedContent = await getNoteContent(id);
                    if (cancelled) return;
                    setContent(loadedContent);
                    lastSavedContentRef.current = loadedContent;
                } catch (error) {
                    if (!cancelled) {
                        console.error('Failed to load note content', error);
                        setContent('');
                        lastSavedContentRef.current = '';
                    }
                } finally {
                    if (!cancelled) {
                        setIsLoading(false);
                    }
                }
            } else {
                if (!cancelled) {
                    setContent(null);
                    lastSavedContentRef.current = null;
                    setIsLoading(false);
                }
            }
        };

        setIsLoading(Boolean(id));
        void load();

        return () => {
            cancelled = true;
        };
    }, [id, getNoteContent]);

    // Mobile Frontend Scroll Effect
    useEffect(() => {
        if (!blockId || isLoading || !editorRef.current || content === null) return;

        // If we already scrolled to this block, skip it
        if (lastScrolledElementIdRef.current === blockId) return;

        // The React Native WebView takes ~300ms to receive the HTML and render it
        const timer = setTimeout(() => {
            editorRef.current?.scrollToElement(blockId);
            lastScrolledElementIdRef.current = blockId;
        }, 350);

        return () => clearTimeout(timer);
    }, [blockId, isLoading, content]);

    // Reset the scrolled ref when note ID changes
    useEffect(() => {
        lastScrolledElementIdRef.current = null;
    }, [id]);

    useEffect(() => {
        const onBackPress = () => {
            if (!router.canGoBack()) {
                router.replace('/Notes');
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [router]);

    // Handle content changes from the editor
    const handleContentChange = useCallback(async (html: string) => {
        if (!id) return;

        // Prevent redundant updates if content hasn't changed
        if (html === lastSavedContentRef.current) return;
        lastSavedContentRef.current = html;
        setContent(html);

        // Update display title for the header
        const title = generateTitle(html);
        setDisplayTitle(title);

        // Update the note content in the database (this also updates preview)
        const { error } = await updateNoteContent(id, html);

        // Only update the title in metadata if the content update succeeded
        if (!error) {
            updateNoteMetadata(id, { title });
        }
    }, [id, updateNoteMetadata, updateNoteContent]);

    const handleBack = useCallback(() => {
        editorRef.current?.blur();
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/Notes');
        }
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

    const handleDelete = useCallback(async () => {
        if (!id) return;
        isDeletingRef.current = true;
        await deleteNote(id);
        if (source === 'Notes' && router.canGoBack()) {
            router.back();
        } else if (source === 'Notes') {
            router.replace('/Notes');
        } else {
            router.back();
        }
    }, [id, deleteNote, router, source]);

    const handleRestore = useCallback(async () => {
        if (!id) return;
        const restored = await restoreNote(id);
        Toast.show({
            type: 'success',
            text1: 'Note restored',
        });
        if (restored?.folderId) {
            router.replace({ pathname: '/Notes', params: { folderId: restored.folderId } });
        } else {
            router.replace('/Notes');
        }
    }, [id, restoreNote, router]);

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

    const handleCopyBlockLink = useCallback(async (blockId: string) => {
        if (!id) return;
        const link = `annota://note/${id}?blockId=${blockId}`;
        await ExpoClipboard.setStringAsync(link);
        setTimeout(() => {
            Alert.alert('Block Link Copied!', 'The link to this specific block has been copied to your clipboard.');
        }, 500);
    }, [id]);

    const activeNoteContext = useMemo(() => {
        if (!id || !currentNote || content === null) return undefined;
        return {
            id: id,
            title: displayTitle,
            content: purifyNoteHtml(content)
        };
    }, [id, currentNote, content, displayTitle]);


    const { sendMessage: sendAiMessage, isStreaming: isAiStreaming, stop: stopAiMessage } = useAiChat('inline-assistant');
    const handleAIAction = useCallback(async (mode: ContextMode | 'send-to-chat', instructions?: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const selection = editor.getSelection();
        const selectedText = selection.text;
        const selectedHtml = selection.html;

        if (!selectedText && !selectedHtml) {
            Alert.alert('No selection', 'Please select some text first to use AI actions.');
            return;
        }

        if (mode === 'send-to-chat') {
            useAiStore.getState().setChatContext({ text: selectedText, html: selectedHtml || selectedText });
            setIsAiChatVisible(true);
            return;
        }

        await sendAiMessage(instructions || selectedHtml || selectedText, {
            mode: mode as ContextMode,
            manualContext: selectedHtml || selectedText,
            onFinish: async (text) => {
                if (mode === 'rewrite') {
                    // Replace selection
                    editor.onCommand('insertContent', { content: text });
                }
            }
        });
    }, [sendAiMessage]);

    const handleInsertFromAi = useCallback((content: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.onCommand('insertContent', { content });
        setIsAiChatVisible(false);
    }, []);

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
                    headerShadowVisible: false,
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {general.isAiEnabled && !currentNote?.isDeleted && (
                                <HapticPressable
                                    onPress={() => setIsAiChatVisible(true)}
                                    style={[styles.headerButton, { marginLeft: 8 }]}
                                    hitSlop={8}
                                >
                                    <Ionicons name="sparkles" size={22} color={colors.primary} />
                                </HapticPressable>
                            )}
                            <NoteHeaderMenu
                                noteId={id}
                                isPinned={currentNote?.isPinned}
                                isQuickAccess={currentNote?.isQuickAccess}
                                isDeleted={currentNote?.isDeleted}
                                onSearch={handleOpenSearch}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                                onTogglePin={handleTogglePin}
                                onToggleQuickAccess={handleToggleQuickAccess}
                                onVersionHistory={handleVersionHistory}
                                onNoteInfo={handleNoteInfo}
                                onCopyLink={handleCopyLink}
                            />
                        </View>
                    ),
                }}
            />

            <AiChatModal
                visible={isAiChatVisible}
                onClose={() => setIsAiChatVisible(false)}
                initialContext={activeNoteContext}
                onInsertToNote={handleInsertFromAi}
            />

            <NoteInfoModal
                visible={isNoteInfoVisible}
                onClose={() => setIsNoteInfoVisible(false)}
                noteId={id}
                onScrollToElement={handleScrollToElement}
            />

            {isLoading || !isContentReady ? (
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
                        editable={currentNote && !currentNote.isPermDeleted && !currentNote.isDeleted}
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
                        renderToolbar={(props: ToolbarRenderProps) => <EditorToolbar {...props} onAIAction={handleAIAction} isAIStreaming={isAiStreaming} onStopAI={stopAiMessage} />}
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
                                        noteId={id}
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
