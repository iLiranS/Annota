import { AiMessage, purifyNoteHtml, useAiStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { AiContextSelector } from './AiContextSelector';

interface AiChatViewProps {
    messages: AiMessage[];
    isStreaming: boolean;
    error: string | null;
    isConfigured: boolean;
    input: string;
    setInput: (text: string) => void;
    onSend: () => void;
    onClose: () => void;
    initialContext?: { title: string, id: string, content: string };
    selectedContextNotes?: any[];
    onToggleNote?: (note: any) => void;
    onToggleFolder?: (folderId: string) => void;
    onClearAllContext?: () => void;
    currentModelName?: string;
    activeProvider?: string;
    onInsertToNote?: (content: string) => void;
    onStop?: () => void;
}

type ContentSegment =
    | { type: 'markdown'; content: string }
    | { type: 'code'; language: string; content: string }
    | { type: 'math'; content: string }
    | { type: 'flashcard'; content: string };

const BLOCK_SEGMENT_REGEX = /```([\w-]*)\n([\s\S]*?)```|\$\$([\s\S]*?)\$\$|<div[^>]*class=[^>]*flashcard-(?:block|card-container)[^>]*>([\s\S]*)/gi;

function parseAssistantContent(content: string): ContentSegment[] {
    if (!content) return [];

    const segments: ContentSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = BLOCK_SEGMENT_REGEX.exec(content)) !== null) {
        const [fullMatch, codeLanguage = '', codeContent, mathContent, flashcardContent] = match;
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
            const markdownChunk = content.slice(lastIndex, matchIndex);
            if (markdownChunk.trim()) {
                segments.push({ type: 'markdown', content: markdownChunk });
            }
        }

        if (typeof codeContent === 'string') {
            segments.push({
                type: 'code',
                language: codeLanguage || 'code',
                content: codeContent.replace(/\n$/, ''),
            });
        } else if (typeof mathContent === 'string') {
            segments.push({
                type: 'math',
                content: mathContent.trim(),
            });
        } else if (typeof flashcardContent === 'string') {
            segments.push({
                type: 'flashcard',
                content: flashcardContent.trim(),
            });
        }

        lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < content.length) {
        const trailingChunk = content.slice(lastIndex);
        if (trailingChunk.trim()) {
            segments.push({ type: 'markdown', content: trailingChunk });
        }
    }

    if (segments.length === 0) {
        segments.push({ type: 'markdown', content });
    }

    return segments;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createKatexHtml(latex: string, textColor: string, backgroundColor: string): string {
    const escapedLatex = JSON.stringify(latex);
    const safeTextColor = escapeHtml(textColor);
    const safeBackgroundColor = escapeHtml(backgroundColor);

    return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: ${safeBackgroundColor};
        color: ${safeTextColor};
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #math {
        padding: 10px 12px;
      }
      .katex-display {
        margin: 0;
        overflow-x: auto;
        overflow-y: hidden;
      }
    </style>
  </head>
  <body>
    <div id="math"></div>
    <script>
      (function () {
        const el = document.getElementById('math');
        const latex = ${escapedLatex};
        try {
          katex.render(latex, el, { throwOnError: false, displayMode: true, strict: 'ignore' });
        } catch (error) {
          el.textContent = latex;
        }
        setTimeout(function () {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 44);
            window.ReactNativeWebView.postMessage(String(h));
          }
        }, 0);
      })();
    </script>
  </body>
</html>`;
}

function LatexBlock({ latex, textColor, backgroundColor }: { latex: string; textColor: string; backgroundColor: string }) {
    const [height, setHeight] = useState(56);

    const html = useMemo(
        () => createKatexHtml(latex, textColor, backgroundColor),
        [latex, textColor, backgroundColor]
    );

    return (
        <View style={[styles.mathBlockContainer, { backgroundColor }]}>
            <WebView
                originWhitelist={['*']}
                source={{ html }}
                style={[styles.mathWebView, { height }]}
                scrollEnabled={false}
                bounces={false}
                automaticallyAdjustContentInsets={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                onMessage={(event) => {
                    const nextHeight = Number(event.nativeEvent.data);
                    if (!Number.isFinite(nextHeight)) return;
                    if (nextHeight < 30 || nextHeight > 500) return;
                    setHeight(Math.ceil(nextHeight));
                }}
            />
        </View>
    );
}

function FlashcardBlock({ content, colors }: { content: string, colors: any }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    // Indestructible parsing: globally extract all fronts and backs
    // Use highly lenient regexes to tolerate extra spaces or additional classes
    const fronts = Array.from(content.matchAll(/class=[^>]*flashcard-card-front[^>]*>([\s\S]*?)(?:<\/div>|(?=<div[^>]*class=[^>]*flashcard-card-back))/gi));
    const backs = Array.from(content.matchAll(/class=[^>]*flashcard-card-back[^>]*>([\s\S]*?)(?:<\/div>|(?=<div[^>]*class=[^>]*flashcard-card-(?:container|front)|$))/gi));

    const cardsCount = Math.max(fronts.length, backs.length);
    const cards = useMemo(() => {
        const c = [];
        for (let j = 0; j < cardsCount; j++) {
            const f = fronts[j] ? fronts[j][1].replace(/<[^>]*>?/gm, '').trim() : '';
            const b = backs[j] ? backs[j][1].replace(/<[^>]*>?/gm, '').trim() : '';
            if (f || b) c.push({ front: f, back: b });
        }
        return c;
    }, [content]);

    if (cards.length === 0) return null;
    const card = cards[currentIndex];
    if (!card) return null;

    return (
        <View style={{ gap: 10, marginVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '30', backgroundColor: colors.primary + '08', overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.primary + '15', backgroundColor: colors.card + '50' }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text + '80', textTransform: 'uppercase' }}>
                    Flashcards ({currentIndex + 1} of {cards.length})
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity
                        onPress={() => { setCurrentIndex(c => Math.max(0, c - 1)); setIsFlipped(false); }}
                        disabled={currentIndex === 0}
                        style={{ padding: 4, opacity: currentIndex === 0 ? 0.3 : 1 }}
                    >
                        <Ionicons name="chevron-back" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => { setCurrentIndex(c => Math.min(cards.length - 1, c + 1)); setIsFlipped(false); }}
                        disabled={currentIndex === cards.length - 1}
                        style={{ padding: 4, opacity: currentIndex === cards.length - 1 ? 0.3 : 1 }}
                    >
                        <Ionicons name="chevron-forward" size={16} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsFlipped(!isFlipped)}
                style={{ padding: 16, minHeight: 120, justifyContent: 'center', backgroundColor: colors.card + (isFlipped ? '50' : '20') }}
            >
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.primary + '80', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                    {isFlipped ? 'Answer' : 'Question'}
                </Text>
                <Text selectable style={{ fontSize: 15, fontWeight: isFlipped ? 'normal' : '600', color: colors.text, textAlign: 'center', lineHeight: 22 }}>
                    {isFlipped ? card.back : card.front}
                </Text>
            </TouchableOpacity>

            <View style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.primary + '05', borderTopWidth: 1, borderTopColor: colors.primary + '10' }}>
                <Text style={{ fontSize: 9, textAlign: 'center', color: colors.text + '60', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Tap card to flip
                </Text>
            </View>
        </View>
    );
}

function AiProcessBlock({
    reasoningContent,
    toolCalls,
    isStreaming,
    colors,
}: {
    reasoningContent?: string | null;
    toolCalls?: string[] | null;
    isStreaming: boolean;
    colors: { text: string; border: string; primary: string; card: string };
}) {
    const [isOpen, setIsOpen] = useState(isStreaming);
    const hasReasoning = Boolean(reasoningContent?.trim());
    const hasTools = Boolean(toolCalls?.length);

    useEffect(() => {
        if (isStreaming) setIsOpen(true);
    }, [isStreaming]);

    if (!hasReasoning && !hasTools) return null;

    return (
        <View style={[styles.processBlock, { borderColor: colors.border + '66', backgroundColor: colors.border + '18' }]}>
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIsOpen(open => !open)}
                style={styles.processHeader}
            >
                <View style={styles.processHeaderLeft}>
                    <Ionicons name="hardware-chip-outline" size={14} color={colors.text + '99'} />
                    <Text style={[styles.processTitle, { color: colors.text + '99' }]}>
                        {isStreaming ? 'Thinking' : 'Thought process'}
                    </Text>
                </View>
                <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.text + '80'}
                />
            </TouchableOpacity>

            {isOpen && (
                <View style={[styles.processBody, { borderTopColor: colors.border + '55' }]}>
                    {hasTools && (
                        <View style={styles.toolList}>
                            {toolCalls?.map(tool => (
                                <View
                                    key={tool}
                                    style={[styles.toolChip, { borderColor: colors.border + '66', backgroundColor: colors.card + '80' }]}
                                >
                                    <Ionicons name="construct-outline" size={11} color={colors.text + '99'} />
                                    <Text style={[styles.toolText, { color: colors.text + '99' }]}>{tool}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {hasReasoning && (
                        <Text selectable style={[styles.reasoningText, { color: colors.text + 'B3' }]}>
                            {reasoningContent}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

function AssistantMessageContent({
    content,
    reasoningContent,
    toolCalls,
    isStreaming,
    colors,
}: {
    content: string;
    reasoningContent?: string | null;
    toolCalls?: string[] | null;
    isStreaming: boolean;
    colors: { text: string; border: string; primary: string; card: string };
}) {
    const segments = useMemo(() => parseAssistantContent(content), [content]);

    const markdownStyle: any = useMemo(
        () => ({
            body: { color: colors.text, fontSize: 16, lineHeight: 24 },
            code_inline: {
                backgroundColor: colors.border + '55',
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 1,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            },
            link: { color: colors.primary, textDecorationLine: 'underline' },
            paragraph: { marginVertical: 4 },
            list_item: { marginVertical: 2 },
            bullet_list: { marginVertical: 4 },
            ordered_list: { marginVertical: 4 },
            heading1: { fontSize: 24, fontWeight: '700', marginVertical: 12 },
            heading2: { fontSize: 20, fontWeight: '700', marginVertical: 10 },
            heading3: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
            blockquote: {
                borderLeftColor: colors.primary + '80',
                borderLeftWidth: 3,
                paddingLeft: 10,
                marginVertical: 8,
                color: colors.text + 'CC',
            },
            table: {
                borderWidth: 1,
                borderColor: colors.border + '55',
                borderRadius: 8,
                marginVertical: 8,
                overflow: 'hidden',
            },
            thead: {
                backgroundColor: colors.border + '33',
            },
            th: {
                padding: 8,
                fontWeight: '700',
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.border + '55',
                color: colors.text,
            },
            td: {
                padding: 8,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.border + '33',
                color: colors.text,
            },
        }),
        [colors]
    );

    return (
        <View style={styles.assistantContent}>
            <AiProcessBlock
                reasoningContent={reasoningContent}
                toolCalls={toolCalls}
                isStreaming={isStreaming}
                colors={colors}
            />

            {segments.map((segment, index) => {
                if (segment.type === 'markdown') {
                    return (
                        <Markdown key={`md-${index}`} style={markdownStyle}>
                            {segment.content}
                        </Markdown>
                    );
                }

                if (segment.type === 'code') {
                    return (
                        <View
                            key={`code-${index}`}
                            style={[
                                styles.codeBlockWrapper,
                                { borderColor: colors.border + '55', backgroundColor: colors.border + '20' },
                            ]}
                        >
                            <View style={[styles.codeBlockHeader, { borderBottomColor: colors.border + '55' }]}>
                                <Text style={[styles.codeBlockLang, { color: colors.text + '99' }]}>
                                    {segment.language}
                                </Text>
                                <TouchableOpacity
                                    style={styles.codeCopyButton}
                                    onPress={async () => {
                                        await Clipboard.setStringAsync(segment.content);
                                    }}
                                >
                                    <Ionicons name="copy-outline" size={14} color={colors.text + '99'} />
                                </TouchableOpacity>
                            </View>
                            <Text selectable style={[styles.codeBlockText, { color: colors.text }]}>
                                {segment.content}
                            </Text>
                        </View>
                    );
                }

                if (segment.type === 'flashcard') {
                    return (
                        <FlashcardBlock
                            key={`fc-${index}`}
                            content={segment.content}
                            colors={colors}
                        />
                    );
                }

                return (
                    <LatexBlock
                        key={`math-${index}`}
                        latex={segment.content}
                        textColor={colors.text}
                        backgroundColor={colors.card}
                    />
                );
            })}
        </View>
    );
}

export function AiChatView({
    messages,
    isStreaming,
    error,
    isConfigured,
    input,
    setInput,
    onSend,
    onClose,
    initialContext,
    selectedContextNotes = [],
    onToggleNote,
    onToggleFolder,
    onClearAllContext,
    currentModelName,
    activeProvider,
    onInsertToNote,
    onStop
}: AiChatViewProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const [isContextSelectorVisible, setIsContextSelectorVisible] = useState(false);
    const [isOptionsVisible, setIsOptionsVisible] = useState(false);
    const { chatContext, setChatContext, webSearchEnabled, setWebSearchEnabled, reasoningEnabled, setReasoningEnabled } = useAiStore();
    const supportsWebSearch = activeProvider === 'openai' || activeProvider === 'google' || activeProvider === 'anthropic';
    const visibleMessages = useMemo(() => messages.filter(m => m.role !== 'system'), [messages]);
    const streamingMessageId = useMemo(
        () => isStreaming ? [...visibleMessages].reverse().find(m => m.role === 'assistant')?.id : null,
        [isStreaming, visibleMessages]
    );

    const displayModelName = useMemo(() => {
        if (!currentModelName) return '';
        return currentModelName.length > 15 ? currentModelName.slice(0, 15) + '...' : currentModelName;
    }, [currentModelName]);

    const initialScrollDone = useRef(false);

    useEffect(() => {
        if (messages.length > 0) {
            if (!initialScrollDone.current) {
                const timer = setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                    initialScrollDone.current = true;
                }, 100);
                return () => clearTimeout(timer);
            } else if (isStreaming) {
                flatListRef.current?.scrollToEnd({ animated: true });
            }
        } else {
            initialScrollDone.current = false;
        }
    }, [messages, isStreaming]);

    const handleInsert = useCallback((content: string) => {
        if (!onInsertToNote) return;

        const fronts = Array.from(content.matchAll(/class=[^>]*flashcard-card-front[^>]*>([\s\S]*?)(?:<\/div>|(?=<div[^>]*class=[^>]*flashcard-card-back))/gi));
        const backs = Array.from(content.matchAll(/class=[^>]*flashcard-card-back[^>]*>([\s\S]*?)(?:<\/div>|(?=<div[^>]*class=[^>]*flashcard-card-(?:container|front)|$))/gi));

        const cardsCount = Math.max(fronts.length, backs.length);
        const cards = [];
        for (let j = 0; j < cardsCount; j++) {
            const f = fronts[j] ? fronts[j][1].replace(/<[^>]*>?/gm, '').trim() : '';
            const b = backs[j] ? backs[j][1].replace(/<[^>]*>?/gm, '').trim() : '';
            if (f || b) cards.push({ front: f, back: b });
        }

        let finalHtml = content;

        if (cards.length > 0) {
            const firstFlashcardIndex = content.search(/<div[^>]*class=[^>]*flashcard-(?:block|card-container)/i);
            const markdownContent = firstFlashcardIndex !== -1
                ? content.slice(0, firstFlashcardIndex).trim()
                : '';

            finalHtml = markdownContent ? markdownContent + '\n\n' : '';
            finalHtml += '<div class="flashcard-block" data-fc="true">\n';
            cards.forEach(c => {
                finalHtml += `  <div class="flashcard-card-container">\n    <div class="flashcard-card-front">${c.front}</div>\n    <div class="flashcard-card-back">${c.back}</div>\n  </div>\n`;
            });
            finalHtml += '</div>';
        }

        onInsertToNote(finalHtml);
    }, [onInsertToNote]);

    return (
        <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
        >
            {isOptionsVisible && (
                <TouchableOpacity
                    activeOpacity={1}
                    style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                    onPress={() => setIsOptionsVisible(false)}
                />
            )}
            <FlatList
                ref={flatListRef}
                data={visibleMessages}
                keyExtractor={(item, index) => item.id || index.toString()}
                contentContainerStyle={styles.messageList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                    <View style={[
                        styles.messageContainer,
                        item.role === 'user' ? styles.userMessageContainer : styles.aiMessageContainer
                    ]}>
                        <View style={[
                            styles.messageBubble,
                            item.role === 'user'
                                ? [styles.userMessage, { backgroundColor: colors.primary }]
                                : [styles.aiMessage, { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 }]
                        ]}>
                            {item.role === 'user' ? (
                                <Text selectable style={[styles.messageText, { color: '#FFF' }]}>
                                    {item.content}
                                </Text>
                            ) : (
                                <AssistantMessageContent
                                    content={item.content}
                                    reasoningContent={item.reasoningContent}
                                    toolCalls={item.toolCalls}
                                    isStreaming={item.id === streamingMessageId}
                                    colors={{
                                        text: colors.text,
                                        border: colors.border,
                                        primary: colors.primary,
                                        card: colors.card,
                                    }}
                                />
                            )}
                        </View>
                        {!item.content && isStreaming && item.role === 'assistant' && (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
                        )}
                        {item.role === 'assistant' && item.content && !isStreaming && (
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                                {onInsertToNote && (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary + '15', borderRadius: 8 }}
                                        onPress={() => handleInsert(item.content)}
                                    >
                                        <Ionicons name="download-outline" size={14} color={colors.primary} />
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Insert to note</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.text + '08', borderRadius: 8 }}
                                    onPress={async () => {
                                        await Clipboard.setStringAsync(item.content);
                                    }}
                                >
                                    <Ionicons name="copy-outline" size={14} color={colors.text + '60'} />
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text + '60' }}>Copy</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={
                    !isConfigured ? (
                        <View style={styles.placeholderContainer}>
                            <View style={[styles.warningIcon, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="warning" size={32} color="#D97706" />
                            </View>
                            <Text style={[styles.placeholderTitle, { color: colors.text }]}>AI Not Configured</Text>
                            <Text style={[styles.placeholderText, { color: colors.text + '60' }]}>
                                Please add your API key in settings to start chatting.
                            </Text>
                            <TouchableOpacity
                                style={[styles.configButton, { backgroundColor: colors.primary }]}
                                onPress={() => { onClose(); router.push('/settings/ai'); }}
                            >
                                <Text style={styles.configButtonText}>Open AI Settings</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <Ionicons name="sparkles-outline" size={48} color={colors.text + '10'} />
                            <Text style={[styles.placeholderText, { color: colors.text + '40' }]}>
                                Ask {activeProvider ? activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1) : 'Annota AI'} anything about your notes.{'\n'}Using {displayModelName || 'default model'}.
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    error ? (
                        <View style={{ paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
                            <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>
                                {error}
                            </Text>
                        </View>
                    ) : null
                }
            />
            <View
                style={[
                    styles.inputWrapper,
                    {
                        borderTopColor: colors.border,
                        backgroundColor: colors.card,
                        paddingBottom: Math.max(insets.bottom, 8),
                    },
                ]}
            >
                {chatContext && (
                    <View style={[styles.activeContextBar, { borderBottomColor: colors.border, backgroundColor: colors.primary + '10' }]}>
                        <Ionicons
                            name="chatbox-ellipses"
                            size={14}
                            color={colors.primary}
                        />
                        <Text style={[styles.activeContextTitle, { color: colors.primary, flex: 1, marginHorizontal: 4 }]} numberOfLines={2}>
                            {purifyNoteHtml(chatContext.html).trim() || chatContext.text || 'Selected item'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setChatContext(null)}
                            style={{ padding: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close-circle" size={20} color={colors.primary + '80'} />
                        </TouchableOpacity>
                    </View>
                )}
                {(initialContext || selectedContextNotes.length > 0) && (
                    <TouchableOpacity
                        style={[styles.activeContextBar, { borderBottomColor: colors.border }]}
                        onPress={() => setIsContextSelectorVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={selectedContextNotes.length > 0 ? "layers" : "search"}
                            size={14}
                            color={colors.primary}
                        />
                        <Text style={[styles.activeContextTitle, { color: colors.text + '80' }]} numberOfLines={1}>
                            {selectedContextNotes.length > 0
                                ? `Using ${selectedContextNotes.length} selected ${selectedContextNotes.length === 1 ? 'note' : 'notes'} as context`
                                : `Using global search context`
                            }
                        </Text>
                        {selectedContextNotes.length > 0 && (
                            <TouchableOpacity
                                onPress={() => onClearAllContext?.()}
                                style={{ marginLeft: 'auto', padding: 4 }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close-circle" size={20} color={colors.text + '40'} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>
                )}
                <View style={[styles.inputContainer, { backgroundColor: colors.background + '80', borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={styles.contextButton}
                        onPress={() => setIsContextSelectorVisible(true)}
                    >
                        <Ionicons
                            name={selectedContextNotes.length > 0 ? "add-circle" : "add-circle-outline"}
                            size={24}
                            color={selectedContextNotes.length > 0 ? colors.primary : colors.text + '40'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.webButton,
                            {
                                backgroundColor: (webSearchEnabled || reasoningEnabled)
                                    ? colors.primary + '18'
                                    : 'transparent',
                            },
                        ]}
                        onPress={() => setIsOptionsVisible(!isOptionsVisible)}
                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    >
                        <Ionicons
                            name="options-outline"
                            size={20}
                            color={(webSearchEnabled || reasoningEnabled) ? colors.primary : colors.text + '40'}
                        />
                    </TouchableOpacity>

                    {isOptionsVisible && (
                        <View style={[styles.optionsMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TouchableOpacity
                                style={[styles.optionItem, !supportsWebSearch && { opacity: 0.4 }]}
                                onPress={() => {
                                    if (supportsWebSearch) {
                                        setWebSearchEnabled(!webSearchEnabled);
                                        setIsOptionsVisible(false);
                                    }
                                }}
                                disabled={!supportsWebSearch}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="globe-outline" size={16} color={webSearchEnabled ? colors.primary : colors.text + '80'} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>Web Search</Text>
                                </View>
                                {webSearchEnabled && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.optionItem}
                                onPress={() => {
                                    setReasoningEnabled(!reasoningEnabled);
                                    setIsOptionsVisible(false);
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="hardware-chip-outline" size={16} color={reasoningEnabled ? colors.primary : colors.text + '80'} />
                                    <Text style={[styles.optionText, { color: colors.text }]}>Reasoning Mode</Text>
                                </View>
                                {reasoningEnabled && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                            </TouchableOpacity>
                        </View>
                    )}
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={`Ask ${activeProvider ? activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1) : 'Annota AI'}${displayModelName ? ` (${displayModelName})` : ''}...`}
                        placeholderTextColor={colors.text + '40'}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        editable={!isStreaming}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: (input.trim() && !isStreaming) || isStreaming ? colors.primary : colors.text + '10' }]}
                        onPress={isStreaming ? onStop : onSend}
                        disabled={(!input.trim() && !isStreaming) || !isConfigured}
                    >
                        {isStreaming ? (
                            <Ionicons name="stop" size={20} color="#FFF" />
                        ) : (
                            <Ionicons name="arrow-up" size={20} color={input.trim() ? '#FFF' : colors.text + '30'} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {isContextSelectorVisible && (
                <AiContextSelector
                    selectedNotes={selectedContextNotes}
                    onToggleNote={(note) => onToggleNote?.(note)}
                    onToggleFolder={(folderId) => onToggleFolder?.(folderId)}
                    onClearAll={() => onClearAllContext?.()}
                    onClose={() => setIsContextSelectorVisible(false)}
                />
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    messageList: {
        padding: 16,
        paddingBottom: 32,
        flexGrow: 1,
    },
    messageContainer: {
        marginBottom: 20,
    },
    userMessageContainer: {
        alignItems: 'flex-end',
    },
    aiMessageContainer: {
        alignItems: 'flex-start',
        width: '100%',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 16,
        maxWidth: '85%',
    },
    userMessage: {
        borderBottomRightRadius: 4,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    aiMessage: {
        width: '100%',
    },
    assistantContent: {
        gap: 6,
    },
    processBlock: {
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 4,
    },
    processHeader: {
        minHeight: 34,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    processHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        flex: 1,
    },
    processTitle: {
        fontSize: 12,
        fontWeight: '700',
    },
    processBody: {
        borderTopWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 9,
        gap: 8,
    },
    toolList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    toolChip: {
        borderWidth: 1,
        borderRadius: 7,
        paddingHorizontal: 7,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    toolText: {
        fontSize: 11,
        fontWeight: '600',
    },
    reasoningText: {
        fontSize: 12,
        lineHeight: 18,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    codeBlockWrapper: {
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
        marginVertical: 6,
    },
    codeBlockHeader: {
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        paddingHorizontal: 10,
    },
    codeBlockLang: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    codeCopyButton: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    codeBlockText: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    mathBlockContainer: {
        borderRadius: 10,
        overflow: 'hidden',
        marginVertical: 6,
    },
    mathWebView: {
        width: '100%',
        backgroundColor: 'transparent',
    },
    placeholderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 140,
    },
    placeholderTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    placeholderText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: '80%',
    },
    warningIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    configButton: {
        marginTop: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    configButtonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 15,
    },
    errorContainer: {
        padding: 12,
        backgroundColor: '#FEE2E2',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 13,
        textAlign: 'center',
    },
    inputWrapper: {
        borderTopWidth: 1,
    },
    activeContextBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        gap: 8,
    },
    activeContextTitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginHorizontal: 12,
        marginTop: 12,
        marginBottom: 4,
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderRadius: 24,
        borderWidth: 1,
        gap: 2,
    },
    contextButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        marginLeft: 2,
    },
    webButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        marginRight: 4,
    },
    optionsMenu: {
        position: 'absolute',
        bottom: 55,
        left: 45,
        width: 180,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        padding: 4,
        zIndex: 20,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
