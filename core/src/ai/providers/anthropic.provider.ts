import { AiMessage, useAiStore } from '@annota/core';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';
import { AiProviderAdapter } from '../types';

async function getProxiedFetch() {
    try {
        // @ts-ignore
        if (window.__TAURI_INTERNALS__) {
            const { fetch } = await import('@tauri-apps/plugin-http');
            return fetch;
        }
    } catch (e) { }
    return fetch;
}

export class AnthropicProvider implements AiProviderAdapter {
    id = 'anthropic' as const;

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        onChunk: (text: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelAnthropic } = useAiStore.getState();
        const anthropicKey = await getApiKey('anthropic');
        if (!anthropicKey) throw new Error('Anthropic API Key is missing. Please add it in settings.');

        const fetchFn = await getProxiedFetch();

        const systemPrompt = liveNoteContent
            ? `${DEFAULT_SYSTEM_PROMPT}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : DEFAULT_SYSTEM_PROMPT;

        const messages = history
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

        const response = await fetchFn('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
                'dangerously-allow-browser': 'true'
            },
            body: JSON.stringify({
                model: selectedModelAnthropic,
                system: systemPrompt,
                messages,
                stream: true,
                max_tokens: 4096,
            }),
            signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Anthropic error: ${errorData.error?.message || response.statusText}`);
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
                if (!cleanLine.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(cleanLine.slice(6));
                    if (json.type === 'content_block_delta' && json.delta?.text) {
                        onChunk(json.delta.text);
                    }
                } catch (e) {
                    // Ignore non-json or incomplete chunks
                }
            }
        }
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelAnthropic } = useAiStore.getState();
        const anthropicKey = await getApiKey('anthropic');
        if (!anthropicKey) return 'New Chat';

        const fetchFn = await getProxiedFetch();

        try {
            const response = await fetchFn('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: selectedModelAnthropic,
                    system: 'You are a title generator. Output ONLY a 3-5 word title for the text provided. No quotes.',
                    messages: [{ role: 'user', content: firstMessage }],
                    stream: false,
                    max_tokens: 100,
                }),
            });

            if (!response.ok) return 'New Chat';
            const data = await response.json();
            return data.content[0]?.text?.trim() || 'New Chat';
        } catch (e) {
            return 'New Chat';
        }
    }
}