import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStorageAdapter } from './config';

export type SidebarTab = 'notes' | 'tags' | 'search';

export interface NavigationState {
    sidebarTab: SidebarTab;
    isSettingsOpen: boolean;
    selectedFolderId: string | null;
    selectedTagId: string | null;
    lastViewedNoteId: string | null;
    lastViewedFolderId: string | null;

    setSidebarTab: (tab: SidebarTab) => void;
    setSettingsOpen: (open: boolean) => void;
    setSelectedFolderId: (folderId: string | null) => void;
    setSelectedTagId: (tagId: string | null) => void;
    setLastViewed: (noteId: string | null, folderId: string | null) => void;
    reset: () => void;
}

export const useNavigationStore = create<NavigationState>()(
    persist(
        (set) => ({
            sidebarTab: 'notes',
            isSettingsOpen: false,
            selectedFolderId: null,
            selectedTagId: null,
            lastViewedNoteId: null,
            lastViewedFolderId: null,

            setSidebarTab: (tab) => set({ sidebarTab: tab }),
            setSettingsOpen: (open) => set({ isSettingsOpen: open }),
            setSelectedFolderId: (folderId) => set({ selectedFolderId: folderId, selectedTagId: null }),
            setSelectedTagId: (tagId) => set({ selectedTagId: tagId, selectedFolderId: null }),
            setLastViewed: (noteId, folderId) => set({
                lastViewedNoteId: noteId,
                lastViewedFolderId: folderId
            }),
            reset: () => set({
                sidebarTab: 'notes',
                isSettingsOpen: false,
                selectedFolderId: null,
                selectedTagId: null,
                lastViewedNoteId: null,
                lastViewedFolderId: null,
            }),
        }),
        {
            name: 'navigation-store',
            storage: createJSONStorage(() => createStorageAdapter()),
            skipHydration: true,
        }
    )
);


