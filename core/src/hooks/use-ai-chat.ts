import { buildBulkContext, buildHistoryWindow, prepareNoteContext, purifyNoteHtml, structuredSample } from '../ai/utils';
import {
    aiChats,
    AiMessage,
    aiMessages,
    createAiProvider,
    generateId,
    getDb,
    noteContent,
    noteMetadata,
    SearchRepository,
    useAiStore
} from '../index';
import { asc, eq } from 'drizzle-orm';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ContextMode = 'auto' | 'summary' | 'full';

export function useAiChat(chatId: string | null) {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const { } = useAiStore();

    // Throttling stream updates to avoid React render lag
    const streamingContentRef = useRef('');
    const assistantMessageIdRef = useRef<string | null>(null);

    // Initial load
    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            setError(null);
            assistantMessageIdRef.current = null;
            streamingContentRef.current = '';
            return;
        }

        let cancelled = false;

        const loadMessages = async () => {
            const db = getDb();
            const results = await db.select()
                .from(aiMessages)
                .where(eq(aiMessages.chatId, chatId))
                .orderBy(asc(aiMessages.createdAt))
                .all();

            if (cancelled) return;

            setMessages(prev => {
                // If the DB returned empty but we already have optimistic messages 
                // for this specific chatId, preserve the current state.
                if (results.length === 0 && prev.length > 0 && prev.every(m => m.chatId === chatId)) {
                    return prev;
                }

                // Preserve an in-flight assistant placeholder that hasn't been persisted yet.
                // This avoids dropping live streaming output when a chat is loaded/reloaded.
                const pendingAssistantId = assistantMessageIdRef.current;
                if (!pendingAssistantId) return results;

                const pendingAssistant = prev.find(
                    m => m.id === pendingAssistantId && m.chatId === chatId && m.role === 'assistant'
                );
                if (!pendingAssistant) return results;
                if (results.some((m: AiMessage) => m.id === pendingAssistantId)) return results;

                return [...results, pendingAssistant];
            });
        };

        loadMessages();

        return () => {
            cancelled = true;
        };
    }, [chatId]);

    const lastUpdateTimeRef = useRef(0);

    const updateStreamingMessage = useCallback((content: string) => {
        const assistantId = assistantMessageIdRef.current;
        if (!assistantId) return;

        setMessages(prev => {
            const msgIndex = prev.findIndex(m => m.id === assistantId);
            if (msgIndex === -1) return prev;
            if (prev[msgIndex].content === content) return prev;

            const newMessages = [...prev];
            newMessages[msgIndex] = { ...newMessages[msgIndex], content };
            return newMessages;
        });
    }, []);

    const stop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsStreaming(false);
            assistantMessageIdRef.current = null;
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
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
        options: {
            overrideChatId?: string | null;
            activeNote?: { title: string, content: string, id: string }; // Single note mode
            selectedFolderNotes?: any[]; // Bulk/Folder mode (pass noteMetadata array here)
            mode?: ContextMode;
        } = {}
    ) => {
        const { overrideChatId, activeNote, selectedFolderNotes, mode = 'auto' } = options;
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

        // 1. Get current history and chat state to check for first message
        const currentChat = await db.select().from(aiChats).where(eq(aiChats.id, effectiveChatId)).get();
        const fullHistory = await db.select()
            .from(aiMessages)
            .where(eq(aiMessages.chatId, effectiveChatId))
            .orderBy(asc(aiMessages.createdAt))
            .all();

        const isFirstMessage = !currentChat || fullHistory.length === 0;

        // 2. Handle Context Shifts / First Turn Markers
        const updatedHistory = [...fullHistory];

        if (activeNote) {
            let systemMarker: string | null = null;

            if (isFirstMessage) {
                systemMarker = `[SYSTEM: Initial Context - Note: "${activeNote.title}"]`;
            } else if (activeNote.id !== currentChat?.currentContextId) {
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
                updatedHistory.push(markerMsg);

                // Update chat's currentContextId
                await db.update(aiChats).set({
                    currentContextId: activeNote.id
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
        updatedHistory.push(userMsg);

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
        lastUpdateTimeRef.current = 0;
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
            // Context Preparation with Tiered Trimming
            let liveNoteContext = '';

            // Route A: Bulk/Folder Selection (user explicitly picked notes via "+")
            if (selectedFolderNotes && selectedFolderNotes.length > 0) {
                // Define how to lazily fetch heavy content
                const fetchContent = async (noteId: string) => {
                    const result = await db.select({ content: noteContent.content })
                        .from(noteContent)
                        .where(eq(noteContent.id, noteId))
                        .get();

                    const raw = result?.content || '';
                    return purifyNoteHtml(raw);
                };

                liveNoteContext = await buildBulkContext(
                    content,
                    selectedFolderNotes,
                    fetchContent,
                    (q, ids) => SearchRepository.findRelevantNoteIds(q, ids)
                );
            }
            // Route B: Single Active Note (Your current behavior)
            else if (activeNote) {
                const header = `[Note: ${activeNote.title}]\n`;
                let body = '';
                if (mode === 'summary') body = structuredSample(activeNote.content, 12000);
                else if (mode === 'full') body = activeNote.content;
                else body = prepareNoteContext(activeNote.content, content);

                liveNoteContext = `${header}${body}`;
            }
            // Route C: FTS Auto-Discovery — no explicit context, search entire database
            else {
                try {
                    const relevantIds = await SearchRepository.findRelevantNoteIds(content);

                    if (relevantIds.length > 0) {
                        // Fetch metadata + content for the top matches
                        const contextParts: string[] = [];
                        for (const noteId of relevantIds) {
                            const [meta, body] = await Promise.all([
                                db.select({ title: noteMetadata.title })
                                    .from(noteMetadata)
                                    .where(eq(noteMetadata.id, noteId))
                                    .get(),
                                db.select({ content: noteContent.content })
                                    .from(noteContent)
                                    .where(eq(noteContent.id, noteId))
                                    .get()
                            ]);

                            const title = meta?.title || 'Untitled';
                            const raw = body?.content || '';
                            const clean = purifyNoteHtml(raw);
                            const trimmed = prepareNoteContext(clean, content);
                            contextParts.push(`--- Note: ${title} ---\n${trimmed}`);
                        }

                        liveNoteContext = `[AUTO-DISCOVERED RELEVANT NOTES]\n${contextParts.join('\n\n')}`;
                    }
                } catch (ftsError) {
                    console.warn('[AI] FTS auto-discovery failed, proceeding without context:', ftsError);
                }
            }

            // Apply sliding window to the updated history
            const history = buildHistoryWindow(updatedHistory, 4000);

            console.groupCollapsed('🤖 AI Request Debug');
            console.log('Query:', content);
            console.log('Context Mode:', mode);
            console.log('History Messages:', history.length);
            console.log('Context Size:', liveNoteContext.length, 'chars');
            console.log('Full History Payload:', history);
            console.log('Full Context Payload:', liveNoteContext);
            console.groupEnd();

            await adapter.sendMessage(
                history,
                liveNoteContext,
                (chunk) => {
                    streamingContentRef.current += chunk;

                    const now = Date.now();
                    if (now - lastUpdateTimeRef.current > 64) { // ~15fps is plenty for text on mobile
                        updateStreamingMessage(streamingContentRef.current);
                        lastUpdateTimeRef.current = now;
                    }
                },
                abortControllerRef.current.signal
            );

            // Final UI update to ensure the last chunk is rendered
            updateStreamingMessage(streamingContentRef.current);

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
                console.error('AI Chat Error:', err);
                setError(err.message || 'An error occurred while communicating with the AI.');
            }
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
            assistantMessageIdRef.current = null;
        }
    }, [chatId, generateTitleInBackground]);

    return {
        messages,
        isStreaming,
        error,
        sendMessage,
        stop,
        clearError,
    };
}
