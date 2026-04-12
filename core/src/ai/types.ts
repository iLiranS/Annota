import { AiMessage } from '../db/schema';

export interface AiProviderAdapter {
    id: 'ollama' | 'openai' | 'anthropic' | 'google';
    
    // Core chat function with streaming callback
    sendMessage: (
        history: AiMessage[],
        liveNoteContent: string | null,
        onChunk: (text: string) => void,
        signal?: AbortSignal
    ) => Promise<void>; 

    // Used for background title generation
    generateTitle: (firstMessage: string) => Promise<string>;
}
