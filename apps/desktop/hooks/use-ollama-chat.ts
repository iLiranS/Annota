import { AiMessage, aiChats, aiMessages, generateId, getDb, useAiStore } from '@annota/core';
import { asc, eq } from 'drizzle-orm';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useOllamaChat(chatId: string | null) {
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const { ollamaBaseUrl, selectedModel } = useAiStore();

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
            const { ollamaBaseUrl, selectedModel, triggerChatRefresh } = useAiStore.getState();
            if (!selectedModel) return;

            const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: `Summarize the following text into a 3 to 5 word title. Do not use quotes, punctuation, or conversational filler. Output ONLY the title.\n\nText: ${firstMessage}`,
                    stream: false,
                    system: "You are a title generator. Output only the requested words."
                }),
            });

            if (!response.ok) return;

            const data = await response.json();
            let newTitle = data.response.trim();

            // Fallback cleanup
            newTitle = newTitle.replace(/^["']|["']$/g, '');

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

    const sendMessage = useCallback(async (content: string, contextNotes: Array<{ title: string, content: string }> = [], overrideChatId?: string) => {
        const effectiveChatId = overrideChatId || chatId;
        if (!effectiveChatId || !selectedModel) return;

        const isFirstMessage = messages.length === 0;

        // Abort any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const db = getDb();
        const userMessageId = generateId();
        const assistantId = generateId();

        const timestamp = new Date();

        const userMsg: AiMessage = {
            id: userMessageId,
            chatId: effectiveChatId,
            role: 'user',
            content,
            model: null,
            createdAt: timestamp,
        };

        // Add user message to state and DB
        setMessages(prev => [...prev, userMsg]);
        await db.insert(aiMessages).values(userMsg).run();

        // Update chat's updatedAt
        await db.update(aiChats).set({ updatedAt: timestamp }).where(eq(aiChats.id, effectiveChatId)).run();

        // Define strict system behavior
        const SYSTEM_PROMPT = `You are a highly efficient AI assistant integrated into the Annota note-taking app. 
Your primary directive is brevity. Always answer directly, concisely, and cleanly. 
Do not use conversational filler.

CRITICAL FORMATTING RULES:
1. ALWAYS use raw Markdown for formatting (headers, bold, lists, and tables).
2. NEVER wrap your entire response inside a \`\`\`markdown code block. Just output the raw markdown directly.
3. For mathematical equations, ALWAYS use standard LaTeX delimiters: $ for inline math (e.g., $E=mc^2$) and $$ for block math. Do not use \\( or \\[.`;

        // Prepare messages for Ollama
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        const contextString = contextNotes.length > 0
            ? contextNotes.map(n => `[Note: ${n.title}]\n${n.content}`).join('\n\n')
            : null;

        const ollamaMessages = [];

        // Always include basic system prompt
        let finalSystemContent = SYSTEM_PROMPT;
        if (contextString) {
            finalSystemContent += `\n\nUse the following note contexts to answer accurately:\n${contextString}`;
        }

        ollamaMessages.push({ role: 'system', content: finalSystemContent });
        ollamaMessages.push(...history);
        ollamaMessages.push({ role: 'user', content });

        // Initialize assistant message in state
        streamingContentRef.current = '';
        assistantMessageIdRef.current = assistantId;

        const placeholderAssistant: AiMessage = {
            id: assistantId,
            chatId: effectiveChatId,
            role: 'assistant',
            content: '',
            model: selectedModel,
            createdAt: new Date(),
        };
        setMessages(prev => [...prev, placeholderAssistant]);
        setIsStreaming(true);
        setError(null);

        try {
            const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: ollamaMessages,
                    stream: true,
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.content) {
                            streamingContentRef.current += json.message.content;
                        }
                    } catch (e) {
                        console.error('Error parsing NDJSON chunk', e);
                    }
                }
            }

            // Save assistant message to DB
            const finalAssistantMsg: AiMessage = {
                ...placeholderAssistant,
                content: streamingContentRef.current,
                createdAt: new Date(),
            };
            await db.insert(aiMessages).values(finalAssistantMsg).run();
            // Update chat updatedAt again
            await db.update(aiChats).set({ updatedAt: new Date() }).where(eq(aiChats.id, effectiveChatId)).run();

            // Generate title based on first response if this is a new chat
            // (messages.length was 1 when we started, so now it's basically 2 messages in DB: 1 user + 1 assistant)
            if (isFirstMessage) {
                generateTitleInBackground(streamingContentRef.current, effectiveChatId);
            }

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
    }, [chatId, messages, ollamaBaseUrl, selectedModel, generateTitleInBackground]);

    return {
        messages,
        isStreaming,
        error,
        sendMessage,
        stop,
    };
}
