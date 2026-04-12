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

export interface AiState {
    // Connection
    ollamaBaseUrl: string;
    isOllamaRunning: boolean;
    lastCheckedAt: number | null;
    
    // Models
    availableModels: OllamaModel[];
    selectedModel: string | null;
    isLoadingModels: boolean;
    
    // UI Refresh bits
    refreshTicket: number;
    triggerChatRefresh: () => void;
    
    // Actions
    setOllamaBaseUrl: (url: string) => void;
    checkConnection: () => Promise<boolean>;
    fetchModels: () => Promise<void>;
    setSelectedModel: (model: string | null) => void;
}

export const useAiStore = create<AiState>()(
    persist(
        (set, get) => ({
            // Defaults
            ollamaBaseUrl: 'http://127.0.0.1:11434',
            isOllamaRunning: false,
            lastCheckedAt: null,
            availableModels: [],
            selectedModel: null,
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
        }),
        {
            name: 'ai-store',
            storage: createJSONStorage(() => createStorageAdapter()),
            partialize: (state) => ({
                ollamaBaseUrl: state.ollamaBaseUrl,
                selectedModel: state.selectedModel,
            }),
        }
    )
);
