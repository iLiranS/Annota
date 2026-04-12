import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStorageAdapter } from './config';

export interface OllamaModel {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
        parent_model: string;
        format: string;
        family: string;
        families: string[] | null;
        parameter_size: string;
        quantization_level: string;
    };
}

export type AiProviderType = 'ollama' | 'openai' | 'anthropic' | 'google';

export interface AiState {
    // Connection
    activeProvider: AiProviderType;
    ollamaBaseUrl: string;
    isOllamaRunning: boolean;
    lastCheckedAt: number | null;
    
    // API Keys
    openAiKey: string;
    anthropicKey: string;
    googleKey: string;

    // Models
    availableModels: OllamaModel[];
    selectedModel: string | null; // This is for Ollama
    selectedModelOpenAi: string;
    selectedModelAnthropic: string;
    selectedModelGoogle: string;
    isLoadingModels: boolean;
    
    // UI Refresh bits
    refreshTicket: number;
    triggerChatRefresh: () => void;
    
    // Actions
    setOllamaBaseUrl: (url: string) => void;
    checkConnection: () => Promise<boolean>;
    fetchModels: () => Promise<void>;
    setSelectedModel: (model: string | null) => void;
    
    setActiveProvider: (provider: AiProviderType) => void;
    setOpenAiKey: (key: string) => void;
    setAnthropicKey: (key: string) => void;
    setGoogleKey: (key: string) => void;
    setSelectedModelOpenAi: (model: string) => void;
    setSelectedModelAnthropic: (model: string) => void;
    setSelectedModelGoogle: (model: string) => void;
}

export const useAiStore = create<AiState>()(
    persist(
        (set, get) => ({
            // Defaults
            activeProvider: 'ollama',
            ollamaBaseUrl: 'http://127.0.0.1:11434',
            isOllamaRunning: false,
            lastCheckedAt: null,
            openAiKey: '',
            anthropicKey: '',
            googleKey: '',
            availableModels: [],
            selectedModel: null,
            selectedModelOpenAi: 'gpt-4o-mini',
            selectedModelAnthropic: 'claude-3-5-sonnet-latest',
            selectedModelGoogle: 'gemini-2.5-flash-lite',
            isLoadingModels: false,
            refreshTicket: 0,
            triggerChatRefresh: () => set((state) => ({ refreshTicket: state.refreshTicket + 1 })),

            // Actions
            setOllamaBaseUrl: (url) => set({ ollamaBaseUrl: url }),
            
            checkConnection: async () => {
                const { ollamaBaseUrl } = get();
                try {
                    const response = await fetch(`${ollamaBaseUrl}/api/version`);
                    const isRunning = response.ok;
                    set({ isOllamaRunning: isRunning, lastCheckedAt: Date.now() });
                    return isRunning;
                } catch (error) {
                    set({ isOllamaRunning: false, lastCheckedAt: Date.now() });
                    return false;
                }
            },

            fetchModels: async () => {
                const { ollamaBaseUrl } = get();
                set({ isLoadingModels: true });
                try {
                    const response = await fetch(`${ollamaBaseUrl}/api/tags`);
                    if (response.ok) {
                        const data = await response.json();
                        set({ 
                            availableModels: data.models || [], 
                            isOllamaRunning: true,
                            isLoadingModels: false 
                        });
                        
                        // Set default model if none selected
                        const currentSelected = get().selectedModel;
                        if (!currentSelected && data.models?.length > 0) {
                            set({ selectedModel: data.models[0].name });
                        }
                    } else {
                        set({ isOllamaRunning: false, isLoadingModels: false });
                    }
                } catch (error) {
                    set({ isOllamaRunning: false, isLoadingModels: false });
                }
            },

            setSelectedModel: (model) => set({ selectedModel: model }),

            setActiveProvider: (provider) => set({ activeProvider: provider }),
            setOpenAiKey: (key) => set({ openAiKey: key }),
            setAnthropicKey: (key) => set({ anthropicKey: key }),
            setGoogleKey: (key) => set({ googleKey: key }),
            setSelectedModelOpenAi: (model) => set({ selectedModelOpenAi: model }),
            setSelectedModelAnthropic: (model) => set({ selectedModelAnthropic: model }),
            setSelectedModelGoogle: (model) => set({ selectedModelGoogle: model }),
        }),
        {
            name: 'ai-store',
            storage: createJSONStorage(() => createStorageAdapter()),
            partialize: (state) => ({
                activeProvider: state.activeProvider,
                ollamaBaseUrl: state.ollamaBaseUrl,
                selectedModel: state.selectedModel,
                openAiKey: state.openAiKey,
                anthropicKey: state.anthropicKey,
                googleKey: state.googleKey,
                selectedModelOpenAi: state.selectedModelOpenAi,
                selectedModelAnthropic: state.selectedModelAnthropic,
                selectedModelGoogle: state.selectedModelGoogle,
            }),
        }
    )
);
