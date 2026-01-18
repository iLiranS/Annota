import TipTapEditor, { TipTapEditorRef } from '@/components/tiptap-editor';
import { useNotesStore } from '@/stores/notes-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Extracts title and preview from HTML content.
 * - Title: First non-empty text content (first line)
 * - Preview: Second non-empty line or remaining content
 */
function extractTitleAndPreview(html: string): { title: string; preview: string } {
    // Remove HTML tags to get plain text
    const plainText = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();

    // Split by newlines and filter out empty lines
    const lines = plainText.split('\n').filter((line) => line.trim().length > 0);

    const title = lines[0]?.trim() || 'Untitled Note';
    const preview = lines[1]?.trim() || lines[0]?.substring(0, 100).trim() || '';

    return { title, preview };
}

export default function NoteEditor() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const editorRef = useRef<TipTapEditorRef>(null);

    const { getNoteById, updateNote } = useNotesStore();
    const currentNote = id ? getNoteById(id) : undefined;

    // Track the current title for the header (updates as user types)
    const [displayTitle, setDisplayTitle] = useState(currentNote?.title || 'Untitled Note');

    // Handle content changes from the editor
    const handleContentChange = useCallback((html: string) => {
        if (!id) return;

        // Extract title and preview from the content
        const { title, preview } = extractTitleAndPreview(html);

        // Update display title for the header
        setDisplayTitle(title);

        // Update the note in the store
        updateNote(id, {
            content: html,
            title,
            preview,
        });
    }, [id, updateNote]);

    const handleBack = useCallback(() => {
        // Blur editor before navigating back
        editorRef.current?.blur();
        router.back();
    }, [router]);

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
                }}
            />

            <View style={[styles.editorWrapper,]}>
                <TipTapEditor
                    ref={editorRef}
                    initialContent={currentNote.content}
                    onContentChange={handleContentChange}
                    placeholder="Start typing your note..."
                    autofocus={!currentNote.content || currentNote.content === '<p></p>'}
                />
            </View>
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