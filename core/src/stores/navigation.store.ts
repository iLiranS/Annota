import { create } from 'zustand';

export type SidebarTab = 'folders' | 'notes' | 'tags' | 'search';

interface NavigationState {
    quickAccessNoteId: string | null;
    quickAccessFolderId: string | null;
    sidebarTab: SidebarTab;
    setQuickAccessView: (noteId: string, folderId: string | null) => void;
    clearQuickAccessView: () => void;
    setSidebarTab: (tab: SidebarTab) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
    quickAccessNoteId: null,
    quickAccessFolderId: null,
    sidebarTab: 'notes',
    setQuickAccessView: (noteId, folderId) => set({
        quickAccessNoteId: noteId,
        quickAccessFolderId: folderId,
    }),
    clearQuickAccessView: () => set({
        quickAccessNoteId: null,
        quickAccessFolderId: null,
    }),
    setSidebarTab: (tab) => set({ sidebarTab: tab }),
}));

