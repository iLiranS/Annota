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
    latestVersion: string | null;
    dismissedUpdateVersion: string | null;
    setOpen: (isOpen: boolean) => void;
    setLoading: (isLoading: boolean) => void;
    setData: (data: ChangelogData | null) => void;
    setLatestVersion: (version: string | null) => void;
    dismissUpdate: (version: string) => void;
}

export const useChangelogStore = create<ChangelogStore>((set) => ({
    isOpen: false,
    isLoading: false,
    changelogData: null,
    latestVersion: null,
    dismissedUpdateVersion: null,
    setOpen: (isOpen) => set({ isOpen }),
    setLoading: (isLoading) => set({ isLoading }),
    setData: (changelogData) => set({ changelogData }),
    setLatestVersion: (latestVersion) => set({ latestVersion }),
    dismissUpdate: (version) => set({ dismissedUpdateVersion: version }),
}));
