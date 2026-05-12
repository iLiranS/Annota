import { AiMessage, useAiStore } from '@annota/core';
import { getPlatformAdapters } from '../../adapters';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { AiProviderAdapter, StreamChunk } from '../types';

export class OllamaProvider implements AiProviderAdapter {
    id = 'ollama' as const;

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        systemInstructions: string | null,
        onChunk: (chunk: StreamChunk) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { ollamaBaseUrl, selectedModel } = useAiStore.getState();
        if (!selectedModel) throw new Error('No model selected');

        const baseSystemPrompt = systemInstructions || DEFAULT_SYSTEM_PROMPT;
        const liveSystemContent = liveNoteContent
            ? `${baseSystemPrompt}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : baseSystemPrompt;

        const messages = [
            { role: 'system', content: liveSystemContent },
            ...history
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }))
        ];

        const response = await getPlatformAdapters().http.fetch(`${ollamaBaseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages,
                stream: true,
                think: true
            }),
            signal
        });

        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.done) break;
                    if (json.message?.thinking) onChunk({ reasoning: json.message.thinking });
                    if (json.message?.content) onChunk({ text: json.message.content });
                } catch (e) {
                    console.error('Error parsing NDJSON chunk', e);
                }
            }
        }
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { ollamaBaseUrl, selectedModel } = useAiStore.getState();
        if (!selectedModel) return 'New Chat';

        const response = await getPlatformAdapters().http.fetch(`${ollamaBaseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                prompt: `Summarize the following text into a 3 to 5 word title. Do not use quotes, punctuation, or conversational filler. Output ONLY the title.\n\nText: ${firstMessage}`,
                stream: false,
                think: false,
                system: 'You are a title generator. Output only the requested words.',
            }),
        });

        if (!response.ok) return 'New Chat';

        const data = await response.json();
        return data.response.trim().replace(/^["']|["']$/g, '');
    }
}
