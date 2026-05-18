import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NoteTab {
    noteId: string;
    folderId: string;
    isPinned?: boolean;
}

interface NoteTabsState {
    tabs: NoteTab[];
    addTab: (tab: NoteTab) => void;
    removeTab: (noteId: string) => void;
    setTabs: (tabs: NoteTab[]) => void;
    reorderTabs: (startIndex: number, endIndex: number) => void;
    togglePinTab: (noteId: string) => void;
}

export const useNoteTabsStore = create<NoteTabsState>()(
    persist(
        (set) => ({
            tabs: [],
            addTab: (tab) => set((state) => {
                if (state.tabs.find(t => t.noteId === tab.noteId)) return state;
                const newTabs = [...state.tabs, tab];
                const pinned = newTabs.filter(t => t.isPinned);
                const unpinned = newTabs.filter(t => !t.isPinned);
                return { tabs: [...pinned, ...unpinned] };
            }),
            removeTab: (noteId) => set((state) => ({
                tabs: state.tabs.filter(t => t.noteId !== noteId)
            })),
            setTabs: (tabs) => set({ tabs }),
            reorderTabs: (startIndex, endIndex) => set((state) => {
                const result = Array.from(state.tabs);
                const [removed] = result.splice(startIndex, 1);
                result.splice(endIndex, 0, removed);
                const pinned = result.filter(t => t.isPinned);
                const unpinned = result.filter(t => !t.isPinned);
                return { tabs: [...pinned, ...unpinned] };
            }),
            togglePinTab: (noteId) => set((state) => {
                const newTabs = state.tabs.map(t =>
                    t.noteId === noteId ? { ...t, isPinned: !t.isPinned } : t
                );
                const pinned = newTabs.filter(t => t.isPinned);
                const unpinned = newTabs.filter(t => !t.isPinned);
                return { tabs: [...pinned, ...unpinned] };
            }),
        }),
        {
            name: 'annota-note-tabs',
        }
    )
);
