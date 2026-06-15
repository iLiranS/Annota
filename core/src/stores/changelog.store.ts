import { create } from 'zustand';

interface ChangelogData {
    title: string;
    date: string;
    features: string[];
    fixes: string[];
}

interface ChangelogStore {
    isOpen: boolean;
    isLoading: boolean;
    changelogData: ChangelogData | null;
    setOpen: (isOpen: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setData: (data: ChangelogData | null) => void;
}

export const useChangelogStore = create<ChangelogStore>((set) => ({
    isOpen: false,
    isLoading: false,
    changelogData: null,
    setOpen: (isOpen) => set({ isOpen }),
    setLoading: (isLoading) => set({ isLoading }),
    setData: (changelogData) => set({ changelogData }),
}));
