import { AiMessage, useAiStore } from '@annota/core';
import { getPlatformAdapters } from '../../adapters';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { getApiKey } from '../security';
import { normalizeStreamChunk } from '../streaming';
import { AiProviderAdapter, StreamChunk } from '../types';

const THINKING_BUDGET_TOKENS = 4096;

/**
 * Extended thinking is supported on claude-3-7+ and all claude-4+ models.
 * Haiku 4.5 does not support it.
 */
function supportsExtendedThinking(model: string): boolean {
    // claude-3-7-sonnet and all claude-opus-4 / claude-sonnet-4 variants
    if (/^claude-3-7/.test(model)) return true;
    if (/^claude-(opus|sonnet|haiku)-4/.test(model) && !/haiku-4-5/.test(model)) return true;
    return false;
}

export class AnthropicProvider implements AiProviderAdapter {
    id = 'anthropic' as const;

    async sendMessage(
        history: AiMessage[],
        liveNoteContent: string | null,
        systemInstructions: string | null,
        onChunk: (chunk: StreamChunk) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const { selectedModelAnthropic, webSearchEnabled, reasoningEnabled } = useAiStore.getState();
        const anthropicKey = await getApiKey('anthropic');
        if (!anthropicKey) throw new Error('Anthropic API Key is missing. Please add it in settings.');

        const baseSystemPrompt = systemInstructions || DEFAULT_SYSTEM_PROMPT;
        const systemPrompt = liveNoteContent
            ? `${baseSystemPrompt}\n\nUse the following live note context to answer accurately:\n${liveNoteContent}`
            : baseSystemPrompt;

        const messages = history
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

        const useThinking = reasoningEnabled && supportsExtendedThinking(selectedModelAnthropic);

        const tools: Record<string, unknown>[] = [];
        if (webSearchEnabled) {
            tools.push({ type: 'web_search_20250305' });
        }

        const body: Record<string, unknown> = {
            model: selectedModelAnthropic,
            system: systemPrompt,
            messages,
            stream: true,
            // When thinking is enabled, max_tokens must exceed budget_tokens
            max_tokens: useThinking ? THINKING_BUDGET_TOKENS + 4096 : 4096,
        };

        if (useThinking) {
            body.thinking = { type: 'enabled', budget_tokens: THINKING_BUDGET_TOKENS };
            // temperature must be 1 (the only allowed value) when thinking is enabled
            body.temperature = 1;
        }

        if (tools.length > 0) {
            body.tools = tools;
        }

        // interleaved-thinking-2025-05-14 lets thinking blocks stream alongside text
        const betas = useThinking ? ['interleaved-thinking-2025-05-14'] : [];

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'dangerously-allow-browser': 'true',
        };
        if (betas.length > 0) {
            headers['anthropic-beta'] = betas.join(',');
        }

        await getPlatformAdapters().http.streamRequest('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal
        }, (rawChunk) => {
            normalizeStreamChunk(rawChunk).forEach(onChunk);
        });
    }

    async generateTitle(firstMessage: string): Promise<string> {
        const { selectedModelAnthropic } = useAiStore.getState();
        const anthropicKey = await getApiKey('anthropic');
        if (!anthropicKey) return 'New Chat';

        try {
            const response = await getPlatformAdapters().http.fetch('https://api.anthropic.com/v1/messages', {
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
