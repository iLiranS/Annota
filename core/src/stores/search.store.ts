import { create } from 'zustand';
import { SearchService, UnifiedSearchResult } from '../services/search.service';

interface SearchState {
    searchQuery: string;
    searchScope: 'all' | 'current';
    isSearching: boolean;
    dbResults: UnifiedSearchResult[];
    setSearchQuery: (query: string, currentFolderId: string | null) => void;
    setSearchScope: (scope: 'all' | 'current') => void;
    performSearch: (currentFolderId: string | null) => Promise<void>;
    resetSearch: () => void;
    reset: () => void;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

export const useSearchStore = create<SearchState>((set, get) => ({
    searchQuery: '',
    searchScope: 'all',
    isSearching: false,
    dbResults: [],

    setSearchQuery: (query, currentFolderId) => {
        set({ searchQuery: query });

        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (!query.trim()) {
            set({ dbResults: [], isSearching: false });
            return;
        }

        searchTimeout = setTimeout(() => {
            get().performSearch(currentFolderId);
        }, 300);
    },

    setSearchScope: (scope) => set({ searchScope: scope }),

    performSearch: async (currentFolderId) => {
        const { searchQuery, searchScope } = get();

        if (!searchQuery.trim()) {
            set({ dbResults: [], isSearching: false });
            return;
        }

        set({ isSearching: true });

        try {
            const results = await SearchService.executeSearch(searchQuery, searchScope, currentFolderId);
            set({ dbResults: results });
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            set({ isSearching: false });
        }
    },

    resetSearch: () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        set({ searchQuery: '', searchScope: 'all', dbResults: [], isSearching: false });
    },

    reset: () => {
        get().resetSearch();
    }
}));
