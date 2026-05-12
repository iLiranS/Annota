import { AiMessage, useAiStore } from '@annota/core';
import { getPlatformAdapters } from '../../adapters';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';
import { normalizeStreamChunk } from '../streaming';
import { AiProviderAdapter, StreamChunk } from '../types';

/**
 * Models that support the `reasoning` parameter in the Responses API.
 * Only o-series reasoning models accept it; GPT-series do not.
 */
function isReasoningModel(model: string): boolean {
    return /^o\d/i.test(model);
}

export class OpenAiProvider implements AiProviderAdapter {
    id = 'openai' as const;

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        systemInstructions: string | null,
        onChunk: (chunk: StreamChunk) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelOpenAi, webSearchEnabled, reasoningEnabled } = useAiStore.getState();
        const openAiKey = await getApiKey('openai');
        if (!openAiKey) throw new Error('OpenAI API Key is missing. Please add it in settings.');

        const baseSystemPrompt = systemInstructions || DEFAULT_SYSTEM_PROMPT;
        const liveSystemContent = liveNoteContent
            ? `${baseSystemPrompt}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : baseSystemPrompt;

        const input = history
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

        const body: Record<string, unknown> = {
            model: selectedModelOpenAi,
            instructions: liveSystemContent,
            input,
            stream: true,
        };

        // Only o-series models support the reasoning parameter
        if (reasoningEnabled && isReasoningModel(selectedModelOpenAi)) {
            body.reasoning = { effort: 'low', summary: 'auto' };
        }

        // Conditionally add web search tool (costs extra – off by default)
        if (webSearchEnabled) {
            body.tools = [{ type: 'web_search_preview' }];
        }

        await getPlatformAdapters().http.streamRequest('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify(body),
            signal
        }, (rawChunk) => {
            normalizeStreamChunk(rawChunk).forEach(onChunk);
        });
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelOpenAi } = useAiStore.getState();
        const openAiKey = await getApiKey('openai');
        if (!openAiKey) return 'New Chat';

        try {
            const response = await getPlatformAdapters().http.fetch('https://api.openai.com/v1/chat/completions', {
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
