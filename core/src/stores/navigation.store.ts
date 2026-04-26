import { create } from 'zustand';

interface NavigationState {
    quickAccessNoteId: string | null;
    quickAccessFolderId: string | null;
    setQuickAccessView: (noteId: string, folderId: string | null) => void;
    clearQuickAccessView: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
    quickAccessNoteId: null,
    quickAccessFolderId: null,
    setQuickAccessView: (noteId, folderId) => set({
        quickAccessNoteId: noteId,
        quickAccessFolderId: folderId,
    }),
    clearQuickAccessView: () => set({
        quickAccessNoteId: null,
        quickAccessFolderId: null,
    }),
}));
