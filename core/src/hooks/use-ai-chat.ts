import { asc, eq } from 'drizzle-orm';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamChunk } from '../ai/types';
import { buildBulkContext, buildHistoryWindow, purifyNoteHtml } from '../ai/utils';
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

export type ContextMode = 'auto' | 'summary' | 'full' | 'rewrite';

type ThinkTagState = {
    isThinking: boolean;
    pending: string;
};

const THINK_TAGS = ['<think>', '</think>'];

function splitThinkTaggedText(value: string, state: ThinkTagState, flush = false): { text: string; reasoning: string } {
    let input = state.pending + value;
    state.pending = '';

    if (!flush) {
        const lowerInput = input.toLowerCase();
        let holdLength = 0;

        for (const tag of THINK_TAGS) {
            for (let length = 1; length < tag.length; length += 1) {
                if (lowerInput.endsWith(tag.slice(0, length))) {
                    holdLength = Math.max(holdLength, length);
                }
            }
        }

        if (holdLength > 0) {
            state.pending = input.slice(-holdLength);
            input = input.slice(0, -holdLength);
        }
    }

    let text = '';
    let reasoning = '';
    let index = 0;
    const lowerInput = input.toLowerCase();

    while (index < input.length) {
        if (state.isThinking) {
            const closeIndex = lowerInput.indexOf('</think>', index);
            if (closeIndex === -1) {
                reasoning += input.slice(index);
                break;
            }

            reasoning += input.slice(index, closeIndex);
            index = closeIndex + '</think>'.length;
            state.isThinking = false;
        } else {
            const openIndex = lowerInput.indexOf('<think>', index);
            if (openIndex === -1) {
                text += input.slice(index);
                break;
            }

            text += input.slice(index, openIndex);
            index = openIndex + '<think>'.length;
            state.isThinking = true;
        }
    }

    return { text, reasoning };
}

export const AI_ACTION_PROMPTS = {
    rewrite: `You are an expert editor and technical writer. Rewrite the following content to be clear, concise, and professional.
    - Correct any factual, grammatical, or structural errors.
    - Maintain the original meaning and tone unless instructions specify otherwise.
    - Be succinct: Don't extend the text or add fluff unless necessary for clarity.
    - Rich Formatting: Use Markdown tables for data, bold/italics for emphasis, and lists for readability.
    - Diagrams: Use \`\`\`mermaid blocks for any flowcharts or diagrams.
    - Flashcards: If the user asks for flashcards or study material, ALWAYS use this EXACT structure:
      <div class="flashcard-block" data-fc="true">
        <!-- ALL cards go inside this single block -->
        <div class="flashcard-card-container">
          <div class="flashcard-card-front">Short Question 1?</div>
          <div class="flashcard-card-back">Concise Answer 1.</div>
        </div>
        <div class="flashcard-card-container">
          <div class="flashcard-card-front">Short Question 2?</div>
          <div class="flashcard-card-back">Concise Answer 2.</div>
        </div>
      </div>
      CRITICAL: Output EXACTLY ONE <div class="flashcard-block" data-fc="true"> container, and put all card containers inside it. PURE TEXT ONLY: DO NOT use Markdown, code blocks , or LaTeX ($) inside flashcards.
    Output ONLY the rewritten/improved content or replacement HTML. DO NOT include any conversational filler, intro, titles, or explanations. Just the final replacement text/html.`,
};

export function useAiChat(chatId: string | null) {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const { } = useAiStore();

    // Throttling stream updates to avoid React render lag
    const streamingContentRef = useRef('');
    const streamingReasoningRef = useRef('');
    const activeToolsRef = useRef<string[]>([]);
    const thinkTagStateRef = useRef<ThinkTagState>({ isThinking: false, pending: '' });
    const assistantMessageIdRef = useRef<string | null>(null);

    // Initial load
    useEffect(() => {
        setError(null);
        if (!chatId) {
            setMessages([]);
            assistantMessageIdRef.current = null;
            streamingContentRef.current = '';
            streamingReasoningRef.current = '';
            activeToolsRef.current = [];
            thinkTagStateRef.current = { isThinking: false, pending: '' };
            return;
        }

        // Cleanup leaked messages for the ephemeral inline assistant
        if (chatId === 'inline-assistant') {
            getDb().delete(aiMessages).where(eq(aiMessages.chatId, 'inline-assistant')).run();
            getDb().delete(aiChats).where(eq(aiChats.id, 'inline-assistant')).run();
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
    const messagesRef = useRef<AiMessage[]>(messages);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const updateStreamingMessage = useCallback(() => {
        const assistantId = assistantMessageIdRef.current;
        if (!assistantId) return;

        setMessages(prev => {
            const msgIndex = prev.findIndex(m => m.id === assistantId);
            if (msgIndex === -1) return prev;
            const content = streamingContentRef.current;
            const reasoningContent = streamingReasoningRef.current || null;
            const toolCalls = activeToolsRef.current.length > 0 ? [...activeToolsRef.current] : null;
            const current = prev[msgIndex];
            if (
                current.content === content &&
                current.reasoningContent === reasoningContent &&
                JSON.stringify(current.toolCalls ?? null) === JSON.stringify(toolCalls)
            ) return prev;

            const newMessages = [...prev];
            newMessages[msgIndex] = {
                ...current,
                content,
                reasoningContent,
                toolCalls,
            };
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
            selectedFolderNotes?: any[]; // Bulk/Folder mode (pass noteMetadata array here)
            mode?: ContextMode;
            isRetry?: boolean;
            manualContext?: string;
            onFinish?: (text: string) => void;
        } = {}
    ) => {
        const { overrideChatId, selectedFolderNotes, mode = 'auto', isRetry = false, manualContext, onFinish } = options;

        let effectiveMode = mode;

        const effectiveChatId = overrideChatId || chatId;
        if (!effectiveChatId) return;

        const { activeProvider } = useAiStore.getState();
        const adapter = createAiProvider(activeProvider);
        const isEphemeral = effectiveChatId === 'inline-assistant';

        // Abort any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const db = getDb();
        const timestamp = new Date();

        // 1. Get current history and chat state to check for first message
        const currentChat = isEphemeral ? null : await db.select().from(aiChats).where(eq(aiChats.id, effectiveChatId)).get();
        const fullHistory = isEphemeral ? messagesRef.current : await db.select()
            .from(aiMessages)
            .where(eq(aiMessages.chatId, effectiveChatId))
            .orderBy(asc(aiMessages.createdAt))
            .all();

        const isFirstMessage = !currentChat || fullHistory.length === 0;

        // 2. Handle First Turn Markers (If needed)
        const updatedHistory = [...fullHistory];

        // 3. User Message
        if (!isRetry) {
            const userMessageId = generateId();
            const userMsg: AiMessage = {
                id: userMessageId,
                chatId: effectiveChatId,
                role: 'user',
                content,
                reasoningContent: null,
                toolCalls: null,
                model: null,
                createdAt: timestamp,
            };

            setMessages(prev => [...prev, userMsg]);
            if (!isEphemeral) await db.insert(aiMessages).values(userMsg).run();
            updatedHistory.push(userMsg);
        } else {
            // Clean up state from any failed assistant placeholder
            setMessages(prev => {
                const lastUserIndex = [...prev].reverse().findIndex(m => m.role === 'user');
                if (lastUserIndex === -1) return prev;
                return prev.slice(0, prev.length - lastUserIndex);
            });
        }

        // Update chat's updatedAt
        if (!isEphemeral) {
            await db.update(aiChats).set({
                updatedAt: timestamp,
            }).where(eq(aiChats.id, effectiveChatId)).run();
        }

        // 4. Generate title in background if first message
        if (isFirstMessage && !isEphemeral) {
            generateTitleInBackground(content, effectiveChatId);
        }

        // 5. Initialize assistant message 
        const assistantId = generateId();
        streamingContentRef.current = '';
        streamingReasoningRef.current = '';
        activeToolsRef.current = [];
        thinkTagStateRef.current = { isThinking: false, pending: '' };
        lastUpdateTimeRef.current = 0;
        assistantMessageIdRef.current = assistantId;

        const placeholderAssistant: AiMessage = {
            id: assistantId,
            chatId: effectiveChatId,
            role: 'assistant',
            content: '',
            reasoningContent: null,
            toolCalls: null,
            model: null, // Model will be updated by adapter or on save
            createdAt: new Date(),
        };
        setMessages(prev => [...prev, placeholderAssistant]);
        setIsStreaming(true);
        setError(null);

        try {
            // Context Preparation with Tiered Trimming
            let liveNoteContext = '';

            // Route C: Manual Context Only (e.g. Highlighted text)
            if (manualContext) {
                liveNoteContext = `[SELECTED TEXT CONTEXT]\n${purifyNoteHtml(manualContext)}`;
            }
            // Route A: Explicit Selection (user explicitly picked notes)
            else if (selectedFolderNotes && selectedFolderNotes.length > 0) {
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
            // Route B: FTS Auto-Discovery — no explicit context, search entire database
            else {
                try {
                    const relevantIds = await SearchRepository.findRelevantNoteIds(content);

                    if (relevantIds.length > 0) {
                        // Fetch metadata for discovered notes
                        const discoveredNotes = (
                            await Promise.all(
                                relevantIds.map(noteId =>
                                    db.select({
                                        id: noteMetadata.id,
                                        title: noteMetadata.title,
                                        tags: noteMetadata.tags,
                                        preview: noteMetadata.preview,
                                        updatedAt: noteMetadata.updatedAt,
                                    })
                                        .from(noteMetadata)
                                        .where(eq(noteMetadata.id, noteId))
                                        .get()
                                )
                            )
                        ).filter(Boolean);

                        if (discoveredNotes.length > 0) {
                            const fetchContent = async (noteId: string) => {
                                const result = await db.select({ content: noteContent.content })
                                    .from(noteContent)
                                    .where(eq(noteContent.id, noteId))
                                    .get();
                                return purifyNoteHtml(result?.content || '');
                            };

                            liveNoteContext = await buildBulkContext(
                                content,
                                discoveredNotes,
                                fetchContent,
                                (q, ids) => SearchRepository.findRelevantNoteIds(q, ids)
                            );
                        }
                    }
                } catch (ftsError) {
                    console.warn('[AI] FTS auto-discovery failed, proceeding without context:', ftsError);
                }
            }

            const { chatContext, setChatContext } = useAiStore.getState();
            if (chatContext && !isEphemeral) {
                const extra = `[USER REFERENCED THE FOLLOWING TEXT FOR CONTEXT]\n"${purifyNoteHtml(chatContext.html)}"`;
                if (liveNoteContext) {
                    liveNoteContext = extra + '\n\n' + liveNoteContext;
                } else {
                    liveNoteContext = extra;
                }
                setChatContext(null);
            }

            // Apply sliding window to the updated history
            const providerHistory = buildHistoryWindow(updatedHistory, 4000);
            const compactHistoryContext = providerHistory.flatMap((message, index) => {
                const match = message.content.match(/\n\n\[(Previous assistant context: [\s\S]+)\]$/);
                return match ? [{ index, role: message.role, context: match[1] }] : [];
            });

            console.log('\n================ 🤖 AI Request Debug ================');
            console.log('Query:', content);
            console.log('Context Mode:', effectiveMode);
            console.log('Provider History Messages:', providerHistory.length);
            console.log('Context Size:', liveNoteContext.length, 'chars');
            console.log('Provider History Payload:', providerHistory.map(({ role, content }) => ({ role, content })));
            if (compactHistoryContext.length > 0) {
                console.log('Compact History Context:', compactHistoryContext);
            }
            console.log('Full Context Payload:', liveNoteContext);
            console.log('=====================================================\n');

            const systemInstructions = AI_ACTION_PROMPTS[effectiveMode as keyof typeof AI_ACTION_PROMPTS] || null;

            await adapter.sendMessage(
                providerHistory,
                liveNoteContext,
                systemInstructions,
                (chunk: StreamChunk) => {
                    let updated = false;

                    if (chunk.reasoning) {
                        streamingReasoningRef.current += chunk.reasoning;
                        updated = true;
                    }

                    if (chunk.text) {
                        const parts = splitThinkTaggedText(chunk.text, thinkTagStateRef.current);
                        if (parts.text) {
                            streamingContentRef.current += parts.text;
                            updated = true;
                        }
                        if (parts.reasoning) {
                            streamingReasoningRef.current += parts.reasoning;
                            updated = true;
                        }
                    }

                    if (chunk.toolCall && !activeToolsRef.current.includes(chunk.toolCall)) {
                        activeToolsRef.current.push(chunk.toolCall);
                        updated = true;
                    }

                    const now = Date.now();
                    if (updated && now - lastUpdateTimeRef.current > 64) {
                        updateStreamingMessage();
                        lastUpdateTimeRef.current = now;
                    }
                },
                abortControllerRef.current.signal
            );

            // Final UI update to ensure the last chunk is rendered
            const pendingThinkParts = splitThinkTaggedText('', thinkTagStateRef.current, true);
            if (pendingThinkParts.text) streamingContentRef.current += pendingThinkParts.text;
            if (pendingThinkParts.reasoning) streamingReasoningRef.current += pendingThinkParts.reasoning;
            updateStreamingMessage();
            if (onFinish) onFinish(streamingContentRef.current);

            // Save assistant message to DB
            const finalAssistantMsg: AiMessage = {
                ...placeholderAssistant,
                content: streamingContentRef.current,
                reasoningContent: streamingReasoningRef.current || null,
                toolCalls: activeToolsRef.current.length > 0 ? [...activeToolsRef.current] : null,
                model: adapter.id, // Or get specific model name from store if needed
                createdAt: new Date(),
            };
            if (!isEphemeral) {
                await db.insert(aiMessages).values(finalAssistantMsg).run();

                // Update chat updatedAt again
                await db.update(aiChats).set({ updatedAt: new Date() }).where(eq(aiChats.id, effectiveChatId)).run();
            }

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
