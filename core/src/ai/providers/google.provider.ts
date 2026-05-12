import { getPlatformAdapters } from '../../adapters';
import { AiMessage } from '../../db/schema';
import { useAiStore } from '../../stores/ai.store';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';
import { normalizeStreamChunk } from '../streaming';
import { AiProviderAdapter, StreamChunk } from '../types';

/**
 * Maps our flat message history into Gemini's `contents` format.
 * System messages are folded in as a leading user turn when no native
 * system_instruction is used.
 */
function toGeminiContents(messages: AiMessage[]): { role: string; parts: { text: string }[] }[] {
    return messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
}

export class GoogleProvider implements AiProviderAdapter {
    readonly id = 'google';

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        systemInstructions: string | null,
        onChunk: (chunk: StreamChunk) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelGoogle, webSearchEnabled, reasoningEnabled } = useAiStore.getState();
        const googleKey = await getApiKey('google');

        if (!googleKey) {
            throw new Error('Google API key not configured');
        }

        const baseSystemPrompt = systemInstructions || DEFAULT_SYSTEM_PROMPT;
        const systemText = liveNoteContent
            ? `${baseSystemPrompt}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : baseSystemPrompt;

        const contents = toGeminiContents(history);

        // Build request body for the native Gemini API
        const body: Record<string, unknown> = {
            system_instruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: {
                temperature: reasoningEnabled ? 0.7 : 0.7,
                maxOutputTokens: 8192, // Increased max tokens to allow room for both thoughts and output
            },
        };

        if (reasoningEnabled) {
            (body.generationConfig as any).thinkingConfig = {
                includeThoughts: true,
            };
        }

        // Conditionally enable Google Search grounding (costs extra – off by default)
        if (webSearchEnabled) {
            body.tools = [{ googleSearch: {} }];
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelGoogle}:streamGenerateContent?key=${googleKey}&alt=sse`;

        await getPlatformAdapters().http.streamRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal
        }, (rawChunk) => {
            normalizeStreamChunk(rawChunk).forEach(onChunk);
        });
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelGoogle } = useAiStore.getState();
        const googleKey = await getApiKey('google');

        if (!googleKey) return 'Untitled Chat';

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelGoogle}:generateContent?key=${googleKey}`;
            const response = await getPlatformAdapters().http.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: 'You are a title generator. Output ONLY a 3-5 word title for the text provided. No quotes.' }]
                    },
                    contents: [{ role: 'user', parts: [{ text: firstMessage }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 15 },
                })
            });

            if (!response.ok) return 'New Conversation';
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Conversation';
        } catch (error) {
            console.error('Failed to generate Google title:', error);
            return 'New Conversation';
        }
    }
}
