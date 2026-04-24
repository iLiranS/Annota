import { AiMessage } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiContextSelector } from './AiContextSelector';
import {
    ActivityIndicator,
    Alert,
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
}

type ContentSegment =
    | { type: 'markdown'; content: string }
    | { type: 'code'; language: string; content: string }
    | { type: 'math'; content: string };

const BLOCK_SEGMENT_REGEX = /```([\w-]*)\n([\s\S]*?)```|\$\$([\s\S]*?)\$\$/g;

function parseAssistantContent(content: string): ContentSegment[] {
    if (!content) return [];

    const segments: ContentSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = BLOCK_SEGMENT_REGEX.exec(content)) !== null) {
        const [fullMatch, codeLanguage = '', codeContent, mathContent] = match;
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

function AssistantMessageContent({
    content,
    colors,
}: {
    content: string;
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
    onClearAllContext
}: AiChatViewProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const [isContextSelectorVisible, setIsContextSelectorVisible] = useState(false);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    return (
        <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
        >
            <FlatList
                ref={flatListRef}
                data={messages.filter(m => m.role !== 'system')}
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
                                <Text style={[styles.messageText, { color: '#FFF' }]}>
                                    {item.content}
                                </Text>
                            ) : (
                                <AssistantMessageContent
                                    content={item.content}
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
                                Ask anything about your notes.{'\n'}I can search and synthesize information.
                            </Text>
                        </View>
                    )
                }
            />
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

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
                {(initialContext || selectedContextNotes.length > 0) && (
                    <TouchableOpacity 
                        style={[styles.activeContextBar, { borderBottomColor: colors.border }]}
                        onPress={() => setIsContextSelectorVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name={selectedContextNotes.length > 0 ? "layers" : "document-text"} 
                            size={14} 
                            color={colors.primary} 
                        />
                        <Text style={[styles.activeContextTitle, { color: colors.text + '80' }]} numberOfLines={1}>
                            {selectedContextNotes.length > 0 
                                ? `Using ${selectedContextNotes.length} selected notes as context`
                                : `Using context: ${initialContext?.title}`
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
                <View style={styles.inputContainer}>
                    <TouchableOpacity
                        style={styles.contextButton}
                        onPress={() => setIsContextSelectorVisible(true)}
                    >
                        <Ionicons 
                            name={selectedContextNotes.length > 0 ? "add-circle" : "add-circle-outline"} 
                            size={26} 
                            color={selectedContextNotes.length > 0 ? colors.primary : colors.text + '40'} 
                        />
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.input, { color: colors.text, backgroundColor: colors.background + '80', borderColor: colors.border }]}
                        placeholder="Ask Annota AI..."
                        placeholderTextColor={colors.text + '40'}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        editable={!isStreaming}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: input.trim() && !isStreaming && isConfigured ? colors.primary : colors.text + '10' }]}
                        onPress={onSend}
                        disabled={!input.trim() || isStreaming || !isConfigured}
                    >
                        {isStreaming ? (
                            <ActivityIndicator size="small" color="#FFF" />
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
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 0,
        gap: 8,
    },
    contextButton: {
        padding: 6,
        marginBottom: 2,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    }
});
