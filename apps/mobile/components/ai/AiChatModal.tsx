import { AiChat, aiChats, aiMessages, generateId, getDb, useAiChat, useAiStore, useNotesStore } from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
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
}

export default function AiChatModal({ visible, onClose, initialContext, initialFolderId, initialTagId }: AiChatModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { activeProvider, hasOpenAiKey, hasAnthropicKey, hasGoogleKey, refreshTicket } = useAiStore();
    const [input, setInput] = useState('');
    const [chatId, setChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<AiChat[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedContextNotes, setSelectedContextNotes] = useState<any[]>([]);
    const { notes } = useNotesStore();

    // Auto-select folder/tag notes on first open for new chat
    useEffect(() => {
        if (visible && !chatId && (initialFolderId || initialTagId)) {
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
            }
        }
    }, [visible, chatId, initialFolderId, initialTagId]);

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
        const db = getDb();
        await db.delete(aiMessages).where(eq(aiMessages.chatId, id)).run();
        await db.delete(aiChats).where(eq(aiChats.id, id)).run();
        setChats(prev => prev.filter(c => c.id !== id));
        if (chatId === id) {
            setChatId(null);
        }
    };

    const handleSelectChat = (id: string) => {
        setChatId(id);
        setShowHistory(false);
    };

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return;

        let currentChatId = chatId;
        if (!currentChatId) {
            currentChatId = generateId();
            const db = getDb();
            const now = new Date();
            const newChat = {
                id: currentChatId,
                title: 'New Chat',
                createdAt: now,
                updatedAt: now,
                currentContextId: initialContext?.id || null,
            };
            await db.insert(aiChats).values(newChat).run();
            setChats(prev => [newChat, ...prev]);
            setChatId(currentChatId);
        }

        const text = input;
        setInput('');

        await sendMessage(text, {
            overrideChatId: currentChatId,
            activeNote: initialContext,
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
                        {chatId || showHistory ? (
                            <TouchableOpacity
                                onPress={() => {
                                    if (showHistory) setShowHistory(false);
                                    else setShowHistory(true);
                                }}
                                style={styles.backButton}
                            >
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.aiIcon, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="sparkles" size={16} color={colors.primary} />
                            </View>
                        )}
                        <Text style={[styles.headerTitle, { color: colors.text }]}>
                            {showHistory ? 'History' : (chatId ? (chats.find(c => c.id === chatId)?.title || 'Chat') : 'AI Assistant')}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {!showHistory && chats.length > 0 && (
                            <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.headerButton}>
                                <Ionicons name="time-outline" size={22} color={colors.text + '60'} />
                            </TouchableOpacity>
                        )}
                        {showHistory && chats.length > 0 && (
                            <TouchableOpacity onPress={handleClearAllChats} style={styles.headerButton}>
                                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                        {(chatId || showHistory) && (
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
                        chats={chats}
                        onSelectChat={handleSelectChat}
                        onDeleteChat={handleDeleteChat}
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
