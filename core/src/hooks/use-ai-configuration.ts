import { useMemo } from 'react';
import { useAiStore } from '../stores/ai.store';
import { useSettingsStore } from '../stores/settings.store';

export function useAiConfiguration() {
    const { general } = useSettingsStore();
    const aiState = useAiStore();
    
    const isConfigured = useMemo(() => {
        const { 
            activeProvider, 
            isOllamaRunning, 
            selectedModel, 
            hasOpenAiKey, 
            hasAnthropicKey, 
            hasGoogleKey 
        } = aiState;

        switch (activeProvider) {
            case 'ollama':
                return isOllamaRunning && !!selectedModel;
            case 'openai':
                return hasOpenAiKey;
            case 'anthropic':
                return hasAnthropicKey;
            case 'google':
                return hasGoogleKey;
            default:
                return false;
        }
    }, [aiState]);

    return {
        isEnabled: general.isAiEnabled,
        isConfigured,
        /**
         * AI is available only if it is both enabled in settings AND configured with a provider
         */
        isAiAvailable: general.isAiEnabled && isConfigured
    };
}
