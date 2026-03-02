import { Buffer } from 'buffer';
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

    /** Cached AES key derived from master mnemonic */
    aesKey: Buffer | null;
    /** The mnemonic used to derive the cached AES key */
    activeMnemonic: string | null;

    setSyncing: (v: boolean) => void;
    setOnline: (v: boolean) => void;
    setLastSyncAt: (d: Date) => void;
    setSyncError: (e: string | null) => void;
    setAesKey: (mnemonic: string | null, key: Buffer | null) => void;
    clearAesKey: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
    isSyncing: false,
    isOnline: true, // Optimistic default
    lastSyncAt: null,
    syncError: null,
    aesKey: null,
    activeMnemonic: null,

    setSyncing: (isSyncing) => set({ isSyncing }),
    setOnline: (isOnline) => set({ isOnline }),
    setLastSyncAt: (lastSyncAt) => set({ lastSyncAt, syncError: null }),
    setSyncError: (syncError) => set({ syncError }),
    setAesKey: (activeMnemonic, aesKey) => set({ activeMnemonic, aesKey }),
    clearAesKey: () => set({ activeMnemonic: null, aesKey: null }),
}));
