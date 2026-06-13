import { AiChat, aiChats, aiMessages, ANTHROPIC_MODELS, generateId, getDb, GOOGLE_MODELS, OPENAI_MODELS, useAiChat, useAiStore, useNotesStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { desc, eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiChatHistory } from './AiChatHistory';
import { AiChatInput } from './AiChatInput';
import { AiChatView } from './AiChatView';
import { AiContextSelector } from './AiContextSelector';

interface AiChatModalProps {
    visible: boolean;
    onClose: () => void;
    initialContext?: { title: string, id: string, content: string };
    initialFolderId?: string | null;
    initialTagId?: string | null;
    onInsertToNote?: (content: string) => void;
}

export default function AiChatModal({ visible, onClose, initialContext, initialFolderId, initialTagId, onInsertToNote }: AiChatModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {
        activeProvider,
        hasOpenAiKey,
        hasAnthropicKey,
        hasGoogleKey,
        refreshTicket,
        availableModels,
        selectedModel,
        setSelectedModel,
        selectedModelOpenAi,
        selectedModelAnthropic,
        selectedModelGoogle,
        setSelectedModelOpenAi,
        setSelectedModelAnthropic,
        setSelectedModelGoogle
    } = useAiStore();
    const [input, setInput] = useState('');
    const [chatId, setChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<AiChat[]>([]);
    const [showHistory, setShowHistory] = useState(true);
    const [selectedContextNotes, setSelectedContextNotes] = useState<any[]>([]);
    const [isContextSelectorVisible, setIsContextSelectorVisible] = useState(false);
    const { notes } = useNotesStore();
    const supportsWebSearch = activeProvider === 'openai' || activeProvider === 'google' || activeProvider === 'anthropic';

    // Auto-select folder/tag/note context on first open for new chat
    useEffect(() => {
        if (visible) {
            if (!chatId) {
                setShowHistory(true);
                if (initialFolderId || initialTagId) {
                    let initialNotes: any[] = [];
                    if (initialFolderId) {
                        initialNotes = notes.filter(n => n.folderId === initialFolderId && !n.isDeleted && !n.isPermDeleted);
                    } else if (initialTagId) {
                        initialNotes = notes.filter(n => {
                            try {
                                const tags = JSON.parse(n.tags || '[]') as string[];
                                return tags.includes(initialTagId) && !n.isDeleted && !n.isPermDeleted;
                            } catch { return false; }
                        });
                    }
                    if (initialNotes.length > 0) {
                        setSelectedContextNotes(initialNotes);
                        setShowHistory(false); // If we have specific context, maybe go straight to chat?
                    }
                } else if (initialContext && selectedContextNotes.length === 0) {
                    setSelectedContextNotes([initialContext]);
                    setShowHistory(false);
                } else if (useAiStore.getState().chatContext) {
                    setShowHistory(false);
                }
            }
        }
    }, [visible, chatId, initialFolderId, initialTagId, initialContext]);

    const handleToggleNote = useCallback((note: any) => {
        setSelectedContextNotes(prev => {
            const exists = prev.find(n => n.id === note.id);
            if (exists) return prev.filter(n => n.id !== note.id);
            return [...prev, note];
        });
    }, []);

    const handleToggleFolder = useCallback((folderId: string) => {
        const folderNotes = notes.filter(n => n.folderId === folderId && !n.isDeleted && !n.isPermDeleted);
        setSelectedContextNotes(prev => {
            const allInPrev = folderNotes.length > 0 && folderNotes.every(fn => prev.find(pn => pn.id === fn.id));
            if (allInPrev) {
                const folderNoteIds = new Set(folderNotes.map(n => n.id));
                return prev.filter(n => !folderNoteIds.has(n.id));
            } else {
                const existingIds = new Set(prev.map(n => n.id));
                const toAdd = folderNotes.filter(n => !existingIds.has(n.id));
                return [...prev, ...toAdd];
            }
        });
    }, [notes]);

    const handleClearAllContext = useCallback(() => {
        setSelectedContextNotes([]);
    }, []);

    const isConfigured = activeProvider === 'openai' ? hasOpenAiKey :
        activeProvider === 'anthropic' ? hasAnthropicKey :
            hasGoogleKey;

    const { messages, sendMessage, stop, isStreaming, error, clearError } = useAiChat(chatId);

    const loadChats = useCallback(async () => {
        const db = getDb();
        const results = await db.select()
            .from(aiChats)
            .orderBy(desc(aiChats.updatedAt))
            .all();
        setChats(results);
    }, []);

    useEffect(() => {
        if (visible) {
            loadChats();
        }
    }, [visible, loadChats, refreshTicket]);

    const handleNewChat = () => {
        setChatId(null);
        setShowHistory(false);
        setSelectedContextNotes([]);
        setInput('');
        clearError();
    };

    const handleClearAllChats = () => {
        Alert.alert(
            "Clear all conversations?",
            "This will permanently delete all your AI chat history.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        const db = getDb();
                        await db.delete(aiMessages).run();
                        await db.delete(aiChats).run();
                        setChats([]);
                        setChatId(null);
                        setShowHistory(false);
                    }
                }
            ]
        );
    };

    const handleDeleteChat = async (id: string) => {
        if (id === 'ALL') {
            handleClearAllChats();
            return;
        }
        const db = getDb();
        await db.delete(aiMessages).where(eq(aiMessages.chatId, id)).run();
        await db.delete(aiChats).where(eq(aiChats.id, id)).run();
        setChats(prev => prev.filter(c => c.id !== id));
        if (chatId === id) {
            setChatId(null);
        }
    };

    const handleTogglePinChat = async (id: string) => {
        const chat = chats.find(c => c.id === id);
        if (!chat) return;

        const db = getDb();
        const newPinned = !chat.isPinned;
        await db.update(aiChats).set({ isPinned: newPinned }).where(eq(aiChats.id, id)).run();
        setChats(prev => prev.map(c => c.id === id ? { ...c, isPinned: newPinned } : c));
    };

    const handleSelectChat = (id: string) => {
        setChatId(id);
        setShowHistory(false);
    };

    const handleSetModel = (model: string) => {
        if (OPENAI_MODELS.some(m => m.value === model)) {
            useAiStore.getState().setActiveProvider('openai');
            setSelectedModelOpenAi(model);
        } else if (ANTHROPIC_MODELS.some(m => m.value === model)) {
            useAiStore.getState().setActiveProvider('anthropic');
            setSelectedModelAnthropic(model);
        } else if (GOOGLE_MODELS.some(m => m.value === model)) {
            useAiStore.getState().setActiveProvider('google');
            setSelectedModelGoogle(model);
        } else {
            useAiStore.getState().setActiveProvider('ollama');
            setSelectedModel(model);
        }
    };

    const currentModelName = activeProvider === 'ollama'
        ? selectedModel
        : activeProvider === 'openai'
            ? selectedModelOpenAi
            : activeProvider === 'anthropic'
                ? selectedModelAnthropic
                : selectedModelGoogle;



    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;

        let currentChatId = showHistory ? null : chatId;
        if (!currentChatId) {
            currentChatId = generateId();
            const db = getDb();
            const now = new Date();
            const newChat: AiChat = {
                id: currentChatId,
                title: 'New Chat',
                isPinned: false,
                createdAt: now,
                updatedAt: now,
            };
            await db.insert(aiChats).values(newChat).run();
            setChats(prev => [newChat, ...prev]);
            setChatId(currentChatId);
            setShowHistory(false);
        }

        const text = input;
        setInput('');

        await sendMessage(text, {
            overrideChatId: currentChatId,
            selectedFolderNotes: selectedContextNotes.length > 0 ? selectedContextNotes : undefined
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: colors.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
            >
                <View style={[styles.header, { borderBottomColor: colors.border + "60" }]}>
                    <View style={styles.headerLeft}>
                        {!showHistory && (
                            <TouchableOpacity
                                onPress={() => setShowHistory(true)}
                                style={styles.backButton}
                            >
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                        )}
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                            {showHistory ? 'AI Chats' : (chatId ? (chats.find(c => c.id === chatId)?.title || 'Chat') : 'New Chat')}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {showHistory && chats.length > 0 && (
                            <TouchableOpacity
                                onPress={handleClearAllChats}
                                style={[styles.clearHeaderButton, { backgroundColor: '#EF444415' }]}
                            >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Clear all</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={26} color={colors.text + '60'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {!isConfigured && (
                    <TouchableOpacity
                        style={[styles.warningBanner, { backgroundColor: '#FEF3C7' }]}
                        onPress={() => {
                            onClose();
                            router.push('/settings/ai');
                        }}
                    >
                        <Ionicons name="warning" size={16} color="#D97706" />
                        <Text style={styles.warningBannerText}>
                            {activeProvider ? activeProvider.toUpperCase() : 'AI'} is not configured. Tap to configure API key.
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color="#D97706" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                )}

                <View style={{ flex: 1 }}>
                    {showHistory ? (
                        <AiChatHistory
                            chats={[...chats].sort((a, b) => {
                                if (a.isPinned && !b.isPinned) return -1;
                                if (!a.isPinned && b.isPinned) return 1;
                                return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
                            })}
                            onSelectChat={handleSelectChat}
                            onDeleteChat={handleDeleteChat}
                            onTogglePin={handleTogglePinChat}
                            onNewChat={handleNewChat}
                        />
                    ) : (
                        <AiChatView
                            messages={messages}
                            isStreaming={isStreaming}
                            error={error}
                            isConfigured={isConfigured}
                            onClose={onClose}
                            currentModelName={currentModelName ?? undefined}
                            activeProvider={activeProvider ?? undefined}
                            onInsertToNote={onInsertToNote}
                        />
                    )}
                </View>

                <AiChatInput
                    input={input}
                    setInput={setInput}
                    onSend={handleSend}
                    onStop={stop}
                    isStreaming={isStreaming}
                    isConfigured={isConfigured}
                    supportsWebSearch={supportsWebSearch}
                    initialContext={initialContext}
                    selectedContextNotes={selectedContextNotes}
                    onClearAllContext={handleClearAllContext}
                    onOpenContextSelector={() => {
                        Keyboard.dismiss();
                        setIsContextSelectorVisible(true);
                    }}
                />

                {isContextSelectorVisible && (
                    <AiContextSelector
                        selectedNotes={selectedContextNotes}
                        onToggleNote={handleToggleNote}
                        onToggleFolder={handleToggleFolder}
                        onClearAll={handleClearAllContext}
                        onClose={() => setIsContextSelectorVisible(false)}
                    />
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginRight: 12,
    },
    aiIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    headerButton: {
        padding: 6,
    },
    clearHeaderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
        marginRight: 2,
    },
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    closeButton: {
        padding: 6,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    warningBannerText: {
        color: '#D97706',
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
});
