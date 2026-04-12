import { AiMessage, useAiStore } from '@annota/core';
import { AiProviderAdapter } from '../types';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';

// We'll use a dynamic import for Tauri HTTP if available, otherwise fallback to global fetch
// In a desktop environment, useAiChat will be used which is run within the Tauri context.
async function getProxiedFetch() {
    try {
        // @ts-ignore
        if (window.__TAURI_INTERNALS__) {
            const { fetch } = await import('@tauri-apps/plugin-http');
            return fetch;
        }
    } catch (e) {
        console.warn('Tauri HTTP plugin not found, falling back to global fetch');
    }
    return fetch;
}

export class OpenAiProvider implements AiProviderAdapter {
    id = 'openai' as const;

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        onChunk: (text: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelOpenAi } = useAiStore.getState();
        const openAiKey = await getApiKey('openai');
        if (!openAiKey) throw new Error('OpenAI API Key is missing. Please add it in settings.');

        const fetchFn = await getProxiedFetch();

        // Ephemeral injection
        const liveSystemContent = liveNoteContent
            ? `${DEFAULT_SYSTEM_PROMPT}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : DEFAULT_SYSTEM_PROMPT;

        const messages = [
            { role: 'system', content: liveSystemContent },
            ...history.filter(m => m.role !== 'system').map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
                model: selectedModelOpenAi,
                messages,
                stream: true,
            }),
            signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenAI error: ${errorData.error?.message || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine || cleanLine === 'data: [DONE]') continue;
                if (cleanLine.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(cleanLine.replace('data: ', ''));
                        const content = json.choices[0]?.delta?.content;
                        if (content) onChunk(content);
                    } catch (e) {
                        console.error('Error parsing SSE chunk', e);
                    }
                }
            }
        }
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelOpenAi } = useAiStore.getState();
        const openAiKey = await getApiKey('openai');
        if (!openAiKey) return 'New Chat';

        const fetchFn = await getProxiedFetch();

        try {
            const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openAiKey}`
                },
                body: JSON.stringify({
                    model: selectedModelOpenAi,
                    messages: [
                        { role: 'system', content: 'You are a title generator. Output ONLY a 3-5 word title for the text provided. No quotes.' },
                        { role: 'user', content: firstMessage }
                    ],
                    stream: false,
                }),
            });

            if (!response.ok) return 'New Chat';
            const data = await response.json();
            return data.choices[0]?.message?.content?.trim() || 'New Chat';
        } catch (e) {
            return 'New Chat';
        }
    }
}
