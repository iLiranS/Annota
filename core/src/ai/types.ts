import { AiMessage } from '../db/schema';

export interface StreamChunk {
    text?: string;
    reasoning?: string;
    toolCall?: string;
}

export interface AiProviderAdapter {
    id: 'ollama' | 'openai' | 'anthropic' | 'google';

    // Core chat function with streaming callback
    sendMessage: (
        history: AiMessage[],
        liveNoteContent: string | null,
        systemInstructions: string | null,
        onChunk: (chunk: StreamChunk) => void,
        signal?: AbortSignal
    ) => Promise<void>;

    // Used for background title generation
    generateTitle: (firstMessage: string) => Promise<string>;
}
