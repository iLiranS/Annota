import { getPlatformAdapters } from '../../adapters';
import { AiMessage } from '../../db/schema';
import { useAiStore } from '../../stores/ai.store';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';
import { AiProviderAdapter } from '../types';

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

        const liveSystemContent = liveNoteContent
            ? `${DEFAULT_SYSTEM_PROMPT}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : DEFAULT_SYSTEM_PROMPT;

        const messages = [
            { role: 'system', content: liveSystemContent },
            ...history
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }))
        ];

        await getPlatformAdapters().http.streamRequest('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
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
        }, onChunk);
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelGoogle } = useAiStore.getState();
        const googleKey = await getApiKey('google');

        if (!googleKey) return 'Untitled Chat';

        try {
            const response = await getPlatformAdapters().http.fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${googleKey}`
                },
                body: JSON.stringify({
                    model: selectedModelGoogle,
                    messages: [
                        { role: 'system', content: 'You are a title generator. Output ONLY a 3-5 word title for the text provided. No quotes.' },
                        { role: 'user', content: firstMessage }
                    ],
                    temperature: 0.5,
                    max_tokens: 15
                })
            });

            if (!response.ok) return 'New Conversation';
            const data = await response.json();
            return data.choices[0]?.message?.content?.trim() || 'New Conversation';
        } catch (error) {
            console.error('Failed to generate Google title:', error);
            return 'New Conversation';
        }
    }
}