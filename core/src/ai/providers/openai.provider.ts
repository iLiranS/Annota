import { AiMessage, useAiStore } from '@annota/core';
import { getPlatformAdapters } from '../../adapters';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';
import { AiProviderAdapter } from '../types';


export class OpenAiProvider implements AiProviderAdapter {
    id = 'openai' as const;

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        systemInstructions: string | null,
        onChunk: (text: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelOpenAi } = useAiStore.getState();
        const openAiKey = await getApiKey('openai');
        if (!openAiKey) throw new Error('OpenAI API Key is missing. Please add it in settings.');

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

        await getPlatformAdapters().http.streamRequest('https://api.openai.com/v1/chat/completions', {
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
        }, onChunk);
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