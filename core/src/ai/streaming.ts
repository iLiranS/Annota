import type { StreamChunk } from './types';

function labelToolCall(rawName: unknown): string | null {
    if (typeof rawName !== 'string' || rawName.trim().length === 0) return null;

    const normalized = rawName.trim();
    const lower = normalized.toLowerCase();

    if (lower.includes('google_search')) return 'Google Search';
    if (lower.includes('web_search') || lower.includes('search')) return 'Web Search';

    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function pushIfPresent(chunks: StreamChunk[], chunk: StreamChunk) {
    if (chunk.text || chunk.reasoning || chunk.toolCall) {
        chunks.push(chunk);
    }
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function normalizeStreamChunk(raw: unknown): StreamChunk[] {
    if (typeof raw === 'string') {
        return raw ? [{ text: raw }] : [];
    }

    if (!raw || typeof raw !== 'object') return [];

    const data = raw as any;
    const chunks: StreamChunk[] = [];

    if (data.type === 'response.output_text.delta') {
        pushIfPresent(chunks, { text: asString(data.delta) });
    }

    if (
        data.type === 'response.reasoning_summary_text.delta' ||
        data.type === 'response.reasoning_text.delta'
    ) {
        pushIfPresent(chunks, { reasoning: asString(data.delta) });
    }

    if (data.type === 'response.reasoning_text.done') {
        pushIfPresent(chunks, { reasoning: asString(data.text) });
    }

    if (
        data.type?.includes?.('web_search_call') ||
        data.item?.type === 'web_search_call' ||
        data.output_item?.type === 'web_search_call'
    ) {
        pushIfPresent(chunks, { toolCall: 'Web Search' });
    }

    const delta = data.choices?.[0]?.delta;

    if (delta) {
        pushIfPresent(chunks, {
            reasoning: asString(delta.reasoning_content ?? delta.reasoningContent ?? delta.reasoning ?? delta.thinking),
        });

        if (typeof delta.content === 'string') {
            pushIfPresent(chunks, { text: delta.content });
        } else if (Array.isArray(delta.content)) {
            for (const part of delta.content) {
                if (part?.thought) {
                    pushIfPresent(chunks, { reasoning: asString(part?.text ?? part?.content) });
                } else {
                    pushIfPresent(chunks, { text: asString(part?.text ?? part?.content) });
                }
            }
        }

        const toolCalls = delta.tool_calls ?? delta.toolCalls;
        if (Array.isArray(toolCalls)) {
            for (const toolCall of toolCalls) {
                const label = labelToolCall(
                    toolCall?.function?.name ?? toolCall?.name ?? toolCall?.type
                );
                pushIfPresent(chunks, { toolCall: label ?? undefined });
            }
        }
    }

    if (data.type === 'content_block_delta' && data.delta) {
        if (data.delta.type === 'thinking_delta') {
            pushIfPresent(chunks, { reasoning: asString(data.delta.thinking) });
        } else {
            pushIfPresent(chunks, { text: asString(data.delta.text) });
        }
    }

    if (data.type === 'content_block_start') {
        const label = labelToolCall(data.content_block?.name ?? data.content_block?.type);
        pushIfPresent(chunks, { toolCall: label ?? undefined });
    }

    const geminiParts = data.candidates?.[0]?.content?.parts;
    if (Array.isArray(geminiParts)) {
        for (const part of geminiParts) {
            if (part?.thought) {
                pushIfPresent(chunks, { reasoning: asString(part.text) });
            } else {
                pushIfPresent(chunks, { text: asString(part?.text) });
            }
        }
    }

    const groundingMetadata = data.candidates?.[0]?.groundingMetadata ?? data.groundingMetadata;
    if (groundingMetadata?.webSearchQueries?.length || groundingMetadata?.groundingChunks?.length) {
        pushIfPresent(chunks, { toolCall: 'Google Search' });
    }

    pushIfPresent(chunks, { reasoning: asString(data.message?.thinking ?? data.thinking) });
    pushIfPresent(chunks, {
        text: asString(data.message?.content ?? (data.type === 'content_block_delta' ? undefined : data.delta?.text) ?? data.content),
    });

    const directToolCalls = data.tool_calls ?? data.toolCalls;
    if (Array.isArray(directToolCalls)) {
        for (const toolCall of directToolCalls) {
            const label = labelToolCall(toolCall?.function?.name ?? toolCall?.name ?? toolCall?.type);
            pushIfPresent(chunks, { toolCall: label ?? undefined });
        }
    }

    return chunks;
}
