import NoteHeaderMenu from '@/components/notes/note-header-menu';
import { SearchOverlay } from '@/components/notes/search-overlay';
import TipTapEditor, { TipTapEditorRef } from '@/components/tiptap-editor';
import { generateTitle } from '@/lib/utils/notes';
import { useNotesStore } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
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
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const editorRef = useRef<TipTapEditorRef>(null);

    const { getNoteById, updateNoteMetadata, getNoteContent, updateNoteContent } = useNotesStore();
    const currentNote = id ? getNoteById(id) : undefined;

    // Lazy-loaded content state
    const [content, setContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Track the current title for the header (updates as user types)
    const [displayTitle, setDisplayTitle] = useState(currentNote?.title || 'Untitled Note');

    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResultCount, setSearchResultCount] = useState(0);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

    // Load content from database on mount
    useEffect(() => {
        if (id) {
            const loadedContent = getNoteContent(id);
            setContent(loadedContent);
            setIsLoading(false);
        }
    }, [id, getNoteContent]);

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
        // Blur editor before navigating back
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

    // Handle case where note doesn't exist
    if (!currentNote) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTitle: 'Note Not Found',
                        headerLeft: () => (
                            <Pressable
                                onPress={() => router.back()}
                                style={styles.headerButton}
                                hitSlop={8}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={26}
                                    color={colors.primary}
                                />
                            </Pressable>
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
                    headerShown: true,
                    headerTitle: () => (
                        <Text
                            style={[styles.headerTitle, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {displayTitle}
                        </Text>
                    ),
                    headerLeft: () => (
                        <Pressable
                            onPress={handleBack}
                            style={styles.headerButton}
                            hitSlop={8}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={26}
                                color={colors.primary}
                            />
                        </Pressable>
                    ),
                    headerBackVisible: false,
                    headerRight: () => (
                        <NoteHeaderMenu noteId={id} onSearch={handleOpenSearch} />
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
                    />

                    <TipTapEditor
                        ref={editorRef}
                        initialContent={content ?? ''}
                        onContentChange={handleContentChange}
                        onSearchResults={handleSearchResults}
                        placeholder="Start typing your note..."
                        autofocus={!content || content === '<p></p>'}
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
        padding: 4,
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