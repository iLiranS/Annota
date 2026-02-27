import { create } from 'zustand';

interface SyncState {
    /** Lock to prevent overlapping push/pull operations */
    isSyncing: boolean;
    /** Mirrors NetInfo connectivity */
    isOnline: boolean;
    /** Timestamp of last successful sync */
    lastSyncAt: Date | null;
    /** Latest error message (cleared on success) */
    syncError: string | null;

    setSyncing: (v: boolean) => void;
    setOnline: (v: boolean) => void;
    setLastSyncAt: (d: Date) => void;
    setSyncError: (e: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isSyncing: false,
    isOnline: true, // Optimistic default
    lastSyncAt: null,
    syncError: null,

    setSyncing: (isSyncing) => set({ isSyncing }),
    setOnline: (isOnline) => set({ isOnline }),
    setLastSyncAt: (lastSyncAt) => set({ lastSyncAt, syncError: null }),
    setSyncError: (syncError) => set({ syncError }),
}));
