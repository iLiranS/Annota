import { fetch } from '@tauri-apps/plugin-http';
import { AiMessage } from '../../db/schema';
import { useAiStore } from '../../stores/ai.store';
import { AiProviderAdapter } from '../types';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';

export class GoogleProvider implements AiProviderAdapter {
    readonly id = 'google';

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        onChunk: (text: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelGoogle } = useAiStore.getState();
        const googleKey = await getApiKey('google');

        if (!googleKey) {
            throw new Error('Google API key not configured');
        }

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

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${googleKey}`
            },
            body: JSON.stringify({
                model: selectedModelGoogle,
                messages,
                stream: true,
                temperature: 0.2,
                max_tokens: 4096
            }),
            signal
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Google API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            onChunk(content);
                        }
                    } catch (e) {
                        console.error('Error parsing Google stream:', e);
                    }
                }
            }
        }
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelGoogle } = useAiStore.getState();
        const googleKey = await getApiKey('google');

        if (!googleKey) return "Untitled Chat";

        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${googleKey}`
                },
                body: JSON.stringify({
                    model: selectedModelGoogle,
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant. Generate a very short (2-4 words) title for this conversation based on the user initial message. Do not use quotes.' },
                        { role: 'user', content: firstMessage }
                    ],
                    temperature: 0.5,
                    max_tokens: 15
                })
            });

            if (!response.ok) return "New Conversation";
            const data = await response.json();
            return data.choices[0]?.message?.content?.trim() || "New Conversation";
        } catch (error) {
            console.error('Failed to generate Google title:', error);
            return "New Conversation";
        }
    }
}
