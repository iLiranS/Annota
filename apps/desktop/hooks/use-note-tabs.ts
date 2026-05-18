import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NoteTab {
    noteId: string;
    folderId: string;
}

interface NoteTabsState {
    tabs: NoteTab[];
    addTab: (tab: NoteTab) => void;
    removeTab: (noteId: string) => void;
    setTabs: (tabs: NoteTab[]) => void;
    reorderTabs: (startIndex: number, endIndex: number) => void;
}

export const useNoteTabsStore = create<NoteTabsState>()(
    persist(
        (set) => ({
            tabs: [],
            addTab: (tab) => set((state) => {
                if (state.tabs.find(t => t.noteId === tab.noteId)) return state;
                return { tabs: [...state.tabs, tab] };
            }),
            removeTab: (noteId) => set((state) => ({
                tabs: state.tabs.filter(t => t.noteId !== noteId)
            })),
            setTabs: (tabs) => set({ tabs }),
            reorderTabs: (startIndex, endIndex) => set((state) => {
                const result = Array.from(state.tabs);
                const [removed] = result.splice(startIndex, 1);
                result.splice(endIndex, 0, removed);
                return { tabs: result };
            }),
        }),
        {
            name: 'annota-note-tabs',
        }
    )
);
