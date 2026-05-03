import { AiChat, aiChats, aiMessages, generateId, getDb, useAiChat, useAiStore, useNotesStore, ANTHROPIC_MODELS, GOOGLE_MODELS, OPENAI_MODELS } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useTheme } from '@react-navigation/native';
import { desc, eq } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiChatHistory } from './AiChatHistory';
import { AiChatView } from './AiChatView';

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
    const { notes } = useNotesStore();

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

    const { messages, sendMessage, isStreaming, error, clearError } = useAiChat(chatId);

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

    const getProviderModels = () => {
        switch (activeProvider) {
            case 'ollama': return availableModels.map(m => ({ label: m.name, value: m.name }));
            case 'openai': return OPENAI_MODELS;
            case 'anthropic': return ANTHROPIC_MODELS;
            case 'google': return GOOGLE_MODELS;
            default: return [];
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;

        let currentChatId = chatId;
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
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <View style={styles.headerLeft}>
                        {!showHistory ? (
                            <TouchableOpacity
                                onPress={() => setShowHistory(true)}
                                style={styles.backButton}
                            >
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.aiIcon, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="sparkles" size={16} color={colors.primary} />
                            </View>
                        )}
                        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                            {showHistory ? 'AI Chats' : (chatId ? (chats.find(c => c.id === chatId)?.title || 'Chat') : 'New Chat')}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {!showHistory ? (
                            <MenuView
                                title="Select Model"
                                onPressAction={({ nativeEvent }) => handleSetModel(nativeEvent.event)}
                                actions={[
                                    ...(availableModels.length > 0 ? [
                                        { id: 'header-ollama', title: 'Ollama', attributes: { disabled: true } },
                                        ...availableModels.map(m => ({ id: m.name, title: m.name, state: (activeProvider === 'ollama' && selectedModel === m.name) ? 'on' as const : 'off' as const })),
                                    ] : []),
                                    { id: 'header-openai', title: 'OpenAI', attributes: { disabled: true } },
                                    ...OPENAI_MODELS.map(m => ({ id: m.value, title: m.label, state: (activeProvider === 'openai' && selectedModelOpenAi === m.value) ? 'on' as const : 'off' as const })),
                                    { id: 'header-anthropic', title: 'Anthropic', attributes: { disabled: true } },
                                    ...ANTHROPIC_MODELS.map(m => ({ id: m.value, title: m.label, state: (activeProvider === 'anthropic' && selectedModelAnthropic === m.value) ? 'on' as const : 'off' as const })),
                                    { id: 'header-google', title: 'Google', attributes: { disabled: true } },
                                    ...GOOGLE_MODELS.map(m => ({ id: m.value, title: m.label, state: (activeProvider === 'google' && selectedModelGoogle === m.value) ? 'on' as const : 'off' as const })),
                                ]}
                            >
                                <TouchableOpacity style={styles.headerButton}>
                                    <Ionicons name="hardware-chip-outline" size={22} color={colors.primary} />
                                </TouchableOpacity>
                            </MenuView>
                        ) : (
                            <TouchableOpacity onPress={handleNewChat} style={styles.headerButton}>
                                <Ionicons name="add" size={26} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={26} color={colors.text + '60'} />
                        </TouchableOpacity>
                    </View>
                </View>

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
                        input={input}
                        setInput={setInput}
                        onSend={handleSend}
                        onClose={onClose}
                        initialContext={initialContext}
                        selectedContextNotes={selectedContextNotes}
                        onToggleNote={handleToggleNote}
                        onToggleFolder={handleToggleFolder}
                        onClearAllContext={handleClearAllContext}
                        currentModelName={currentModelName ?? undefined}
                        activeProvider={activeProvider ?? undefined}
                        onInsertToNote={onInsertToNote}
                    />
                )}
            </View>
        </Modal >
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
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    closeButton: {
        padding: 6,
    }
});
