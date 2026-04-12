import {
    AiMessage,
    aiChats,
    aiMessages,
    createAiProvider,
    generateId,
    getDb,
    useAiStore
} from '@annota/core';
import { asc, eq } from 'drizzle-orm';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useAiChat(chatId: string | null) {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const { } = useAiStore();

    // Throttling stream updates to avoid React render lag
    const streamingContentRef = useRef('');
    const assistantMessageIdRef = useRef<string | null>(null);
    const lastRenderTimeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    // Initial load
    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            return;
        }

        const loadMessages = async () => {
            const db = getDb();
            const results = await db.select()
                .from(aiMessages)
                .where(eq(aiMessages.chatId, chatId))
                .orderBy(asc(aiMessages.createdAt))
                .all();
            setMessages(prev => {
                // If the DB returned empty but we already have optimistic messages 
                // for this specific chatId, preserve the current state.
                if (results.length === 0 && prev.length > 0 && prev.every(m => m.chatId === chatId)) {
                    return prev;
                }
                return results;
            });
        };

        loadMessages();
    }, [chatId]);

    const updateUiWithStreamingContent = useCallback(() => {
        const now = Date.now();
        // Limit UI updates to roughly 60fps (16ms)
        if (now - lastRenderTimeRef.current > 16) {
            setMessages(prev => {
                const assistantId = assistantMessageIdRef.current;
                if (!assistantId) return prev;

                return prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: streamingContentRef.current }
                        : m
                );
            });
            lastRenderTimeRef.current = now;
        }

        if (isStreaming) {
            animationFrameRef.current = requestAnimationFrame(updateUiWithStreamingContent);
        }
    }, [isStreaming]);

    useEffect(() => {
        if (isStreaming) {
            animationFrameRef.current = requestAnimationFrame(updateUiWithStreamingContent);
        } else if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            // Final update to catch the tail
            setMessages(prev => {
                const assistantId = assistantMessageIdRef.current;
                if (!assistantId) return prev;
                return prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: streamingContentRef.current }
                        : m
                );
            });
        }
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isStreaming, updateUiWithStreamingContent]);

    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsStreaming(false);
        }
    }, []);

    const generateTitleInBackground = useCallback(async (firstMessage: string, chatId: string) => {
        try {
            const { activeProvider, triggerChatRefresh } = useAiStore.getState();
            const adapter = createAiProvider(activeProvider);

            const newTitle = await adapter.generateTitle(firstMessage);

            const db = getDb();
            await db.update(aiChats).set({
                title: newTitle,
                updatedAt: new Date()
            }).where(eq(aiChats.id, chatId)).run();

            triggerChatRefresh();
        } catch (error) {
            console.error("Failed to generate title silently:", error);
        }
    }, []);

    const sendMessage = useCallback(async (
        content: string,
        contextNotes: Array<{ title: string, content: string }> = [],
        overrideChatId?: string,
        activeNoteId?: string
    ) => {
        const effectiveChatId = overrideChatId || chatId;
        if (!effectiveChatId) return;

        const { activeProvider } = useAiStore.getState();
        const adapter = createAiProvider(activeProvider);

        // Abort any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const db = getDb();
        const timestamp = new Date();

        // 1. Get current chat state to check for context shifts
        const currentChat = await db.select().from(aiChats).where(eq(aiChats.id, effectiveChatId)).get();
        const isFirstMessage = !currentChat || messages.length === 0;

        // 2. Handle Context Shifts / First Turn Markers
        if (activeNoteId && contextNotes.length > 0) {
            const activeNote = contextNotes[0]; // Assuming for now we primarily track the "active" note

            let systemMarker: string | null = null;

            if (isFirstMessage) {
                systemMarker = `[SYSTEM: Initial Context - Note: "${activeNote.title}"]`;
            } else if (activeNoteId !== currentChat?.currentContextId) {
                systemMarker = `[SYSTEM: Context shifted to note: "${activeNote.title}"]`;
            }

            if (systemMarker) {
                const markerMsg: AiMessage = {
                    id: generateId(),
                    chatId: effectiveChatId,
                    role: 'system',
                    content: systemMarker,
                    model: null,
                    createdAt: new Date(timestamp.getTime() - 1), // Slightly before
                };
                await db.insert(aiMessages).values(markerMsg).run();
                setMessages(prev => [...prev, markerMsg]);

                // Update chat's currentContextId
                await db.update(aiChats).set({
                    currentContextId: activeNoteId
                }).where(eq(aiChats.id, effectiveChatId)).run();
            }
        }

        // 3. User Message
        const userMessageId = generateId();
        const userMsg: AiMessage = {
            id: userMessageId,
            chatId: effectiveChatId,
            role: 'user',
            content,
            model: null,
            createdAt: timestamp,
        };

        setMessages(prev => [...prev, userMsg]);
        await db.insert(aiMessages).values(userMsg).run();

        // Update chat's updatedAt
        await db.update(aiChats).set({
            updatedAt: timestamp,
        }).where(eq(aiChats.id, effectiveChatId)).run();

        // 4. Generate title in background if first message
        if (isFirstMessage) {
            generateTitleInBackground(content, effectiveChatId);
        }

        // 5. Initialize assistant message 
        const assistantId = generateId();
        streamingContentRef.current = '';
        assistantMessageIdRef.current = assistantId;

        const placeholderAssistant: AiMessage = {
            id: assistantId,
            chatId: effectiveChatId,
            role: 'assistant',
            content: '',
            model: null, // Model will be updated by adapter or on save
            createdAt: new Date(),
        };
        setMessages(prev => [...prev, placeholderAssistant]);
        setIsStreaming(true);
        setError(null);

        try {
            // Get full live content for ephemeral injection (Phase 3)
            const liveNoteContent = contextNotes.length > 0
                ? contextNotes.map(n => `[Note: ${n.title}]\n${n.content}`).join('\n\n')
                : null;

            // Fetch history from DB or state (latest)
            const history = await db.select()
                .from(aiMessages)
                .where(eq(aiMessages.chatId, effectiveChatId))
                .orderBy(asc(aiMessages.createdAt))
                .all();

            await adapter.sendMessage(
                history,
                liveNoteContent,
                (chunk) => {
                    streamingContentRef.current += chunk;
                },
                abortControllerRef.current.signal
            );

            // Save assistant message to DB
            const finalAssistantMsg: AiMessage = {
                ...placeholderAssistant,
                content: streamingContentRef.current,
                model: adapter.id, // Or get specific model name from store if needed
                createdAt: new Date(),
            };
            await db.insert(aiMessages).values(finalAssistantMsg).run();

            // Update chat updatedAt again
            await db.update(aiChats).set({ updatedAt: new Date() }).where(eq(aiChats.id, effectiveChatId)).run();

        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                setError(err.message);
                console.error('Chat error:', err);
            }
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    }, [chatId, messages, generateTitleInBackground]);

    return {
        messages,
        isStreaming,
        error,
        sendMessage,
        stop,
    };
}
