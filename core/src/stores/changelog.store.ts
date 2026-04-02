import { create } from 'zustand';

interface ChangelogData {
    title: string;
    date: string;
    features: string[];
    fixes: string[];
}

interface ChangelogStore {
    isOpen: boolean;
    changelogData: ChangelogData | null;
    setOpen: (isOpen: boolean) => void;
    setData: (data: ChangelogData | null) => void;
}

export const useChangelogStore = create<ChangelogStore>((set) => ({
    isOpen: false,
    changelogData: null,
    setOpen: (isOpen) => set({ isOpen }),
    setData: (changelogData) => set({ changelogData }),
}));
