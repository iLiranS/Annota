import { AiProviderType } from '../../stores/ai.store';
import { AiProviderAdapter } from '../types';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider } from './google.provider';
import { OllamaProvider } from './ollama.provider';
import { OpenAiProvider } from './openai.provider';

export * from './anthropic.provider';
export * from './google.provider';
export * from './ollama.provider';
export * from './openai.provider';

export function createAiProvider(type: AiProviderType): AiProviderAdapter {
    switch (type) {
        case 'ollama':
            return new OllamaProvider();
        case 'openai':
            return new OpenAiProvider();
        case 'anthropic':
            return new AnthropicProvider();
        case 'google':
            return new GoogleProvider();
        default:
            const exhaustiveCheck: never = type;
            throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
    }
}
