import { asc, eq } from 'drizzle-orm';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamChunk } from '../ai/types';
import {
    buildBulkContext,
    buildHistoryWindow,
    capTextToTokenBudget,
    estimateContextTokens,
    getContextBudgetConfig,
    purifyNoteHtml
} from '../ai/utils';
import {
    AI_ACTION_PROMPTS,
    aiChats,
    AiMessage,
    aiMessages,
    createAiProvider,
    generateId,
    getDb,
    noteContent,
    SearchRepository,
    useAiStore
} from '../index';

export type ContextMode = 'auto' | 'summary' | 'full' | 'rewrite';

type ThinkTagState = {
    isThinking: boolean;
    pending: string;
};

const THINK_TAGS = ['<think>', '</think>'];
const SELECTED_CHAT_CONTEXT_MAX_CHARS = 1000;

function truncateSelectedChatContext(value: string): string {
    const clean = value.trim();
    if (clean.length <= SELECTED_CHAT_CONTEXT_MAX_CHARS) return clean;

    const sliced = clean.slice(0, SELECTED_CHAT_CONTEXT_MAX_CHARS);
    const lastSpace = sliced.lastIndexOf(' ');
    const trimmed = sliced.slice(0, lastSpace > SELECTED_CHAT_CONTEXT_MAX_CHARS * 0.7 ? lastSpace : SELECTED_CHAT_CONTEXT_MAX_CHARS).trim();
    return `${trimmed}...\n[Selected text truncated to ${SELECTED_CHAT_CONTEXT_MAX_CHARS} characters]`;
}

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


export function useAiChat(chatId: string | null) {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

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

        const effectiveMode = mode;

        const effectiveChatId = overrideChatId || chatId;
        if (!effectiveChatId) return;

        const { activeProvider, chatContext } = useAiStore.getState();
        const hasExplicitNotes = selectedFolderNotes && selectedFolderNotes.length > 0;
        const hasInlineContext = Boolean(manualContext || chatContext);

        if (!hasExplicitNotes && !hasInlineContext) {
            setError("Please select at least one note to start chatting.");
            return;
        }

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
            const systemInstructions = AI_ACTION_PROMPTS[effectiveMode as keyof typeof AI_ACTION_PROMPTS] || AI_ACTION_PROMPTS.default;
            const budgetConfig = getContextBudgetConfig(effectiveMode, selectedFolderNotes?.length ?? 0);
            const historyBudget = Math.min(
                budgetConfig.historyTargetTokens,
                Math.max(
                    budgetConfig.historyFloorTokens,
                    budgetConfig.globalInputBudgetTokens - budgetConfig.systemReserveTokens
                )
            );
            const providerHistory = buildHistoryWindow(updatedHistory, historyBudget);
            const historyText = providerHistory.map(m => `${m.role}: ${m.content}`).join('\n');
            const historyTokens = estimateContextTokens(historyText);
            const maxLiveContextTokens = Math.max(
                0,
                budgetConfig.globalInputBudgetTokens - budgetConfig.systemReserveTokens - historyTokens
            );
            const liveContextParts: string[] = [];
            const truncatedSections: string[] = [];
            const selectedNoteIds: string[] = [];
            let referencedContextText = '';
            let remainingLiveContextTokens = maxLiveContextTokens;
            let contextChunkCount = 0;
            let contextSkeletonCount = 0;

            const appendLiveContext = (label: string, rawText: string, maxTokens: number) => {
                if (!rawText.trim() || remainingLiveContextTokens <= 0) return;

                const requestedBudget = Math.min(maxTokens, remainingLiveContextTokens);
                const capped = capTextToTokenBudget(rawText, requestedBudget, label);
                if (!capped.text) return;

                liveContextParts.push(capped.text);
                remainingLiveContextTokens = Math.max(0, remainingLiveContextTokens - estimateContextTokens(capped.text));

                if (capped.truncated) {
                    truncatedSections.push(label);
                }
            };

            if (manualContext) {
                appendLiveContext(
                    'selected-text',
                    `[SELECTED TEXT CONTEXT]\n${purifyNoteHtml(manualContext)}`,
                    budgetConfig.manualContextMaxTokens
                );
            }

            const { chatContext, setChatContext } = useAiStore.getState();
            if (chatContext && !isEphemeral) {
                referencedContextText = truncateSelectedChatContext(
                    purifyNoteHtml(chatContext.html).trim() || chatContext.text || ''
                );
                appendLiveContext(
                    'selected-chat-context',
                    [
                        '[SELECTED NOTE PASSAGE - PRIMARY CHAT CONTEXT]',
                        'The user explicitly highlighted this passage in the note editor and the next chat message refers to it.',
                        'Treat this selected passage as the highest-priority context. If broader note context is also provided, use it only to clarify this passage.',
                        '',
                        referencedContextText,
                    ].join('\n'),
                    Math.max(budgetConfig.manualContextMaxTokens, 2500)
                );
                setChatContext(null);
            }

            const fetchContent = async (noteId: string) => {
                const isSelected = selectedFolderNotes?.some(n => n.id === noteId);
                if (!isSelected) {
                    console.warn(`[AI Chat] Prevented access to note ${noteId} not in selection context.`);
                    return '';
                }

                const result = await db.select({ content: noteContent.content })
                    .from(noteContent)
                    .where(eq(noteContent.id, noteId))
                    .get();

                return purifyNoteHtml(result?.content || '');
            };

            const noteContextTargets = selectedFolderNotes && selectedFolderNotes.length > 0
                ? selectedFolderNotes
                : null;
            const contextAwareQuery = referencedContextText
                ? `${content}\n${referencedContextText.slice(0, 3000)}`
                : content;

            if (noteContextTargets && noteContextTargets.length > 0 && remainingLiveContextTokens > 0) {
                const bulkContext = await buildBulkContext(
                    contextAwareQuery,
                    noteContextTargets,
                    fetchContent,
                    (q, ids) => SearchRepository.findRelevantNoteIds(q, ids),
                    remainingLiveContextTokens,
                    effectiveMode
                );

                if (bulkContext.text) {
                    liveContextParts.push(bulkContext.text);
                    remainingLiveContextTokens = Math.max(0, remainingLiveContextTokens - estimateContextTokens(bulkContext.text));
                    truncatedSections.push(...bulkContext.metrics.truncatedSections);
                    selectedNoteIds.push(...bulkContext.metrics.selectedNoteIds);
                    contextChunkCount += bulkContext.metrics.chunkCount;
                    contextSkeletonCount += bulkContext.metrics.skeletonCount;
                }
            }

            let liveNoteContext = liveContextParts.join('\n\n');
            const finalLiveBudget = Math.max(
                0,
                budgetConfig.globalInputBudgetTokens - budgetConfig.systemReserveTokens - historyTokens
            );

            const finalLiveContext = capTextToTokenBudget(liveNoteContext, finalLiveBudget, 'live-note-context');
            liveNoteContext = finalLiveContext.text;
            if (finalLiveContext.truncated) {
                truncatedSections.push('live-note-context');
            }

            console.log('\n================ 🤖 AI Request Debug ================');
            console.log('Query:', content);
            console.log('Context Mode:', effectiveMode);
            console.log('Budget:', {
                globalTokens: budgetConfig.globalInputBudgetTokens,
                tokenEstimator: 'Math.ceil(chars / 2)',
                systemReserveTokens: budgetConfig.systemReserveTokens,
                historyBudget,
                historyTokens,
                historyChars: historyText.length,
                liveContextTokens: estimateContextTokens(liveNoteContext),
                liveContextChars: liveNoteContext.length,
                truncatedSections: Array.from(new Set(truncatedSections)),
                selectedNoteIds,
                contextChunkCount,
                contextSkeletonCount,
            });
            console.log('System Instruction Size:', systemInstructions ? `${systemInstructions.length} chars` : '0 chars (null)');
            console.log(`Provider History: ${providerHistory.length} messages (~${historyTokens} tokens)`);
            console.log('Provider History Payload:', providerHistory.map(({ role, content }) => ({
                role,
                chars: content.length,
                estimatedTokens: estimateContextTokens(content),
                content,
            })));
            console.log('Live Context Payload:', liveNoteContext || '(none)');
            console.log('=====================================================\n');

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
