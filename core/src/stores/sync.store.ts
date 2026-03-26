import { Buffer } from 'buffer';
import { create } from 'zustand';
import { createStorageAdapter } from './config';

const getSyncTimeKey = (userId: string) => `${userId}_last_sync_time`;
const storage = createStorageAdapter();


interface SyncState {
    /** Lock to prevent overlapping push/pull operations */
    isSyncing: boolean;
    /** Mirrors NetInfo connectivity */
    isOnline: boolean;
    /** Timestamp of last successful sync */
    lastSyncAt: Date | null;
    /** Latest error message (cleared on success) */
    syncError: string | null;

    /** Cached master key derived from mnemonic+salt */
    derivedMasterKey: Buffer | null;
    /** Cached subkey for notes/content */
    notesKey: Buffer | null;
    /** Cached subkey for files/blobs */
    filesKey: Buffer | null;
    /** The mnemonic used to derive the cached keys */
    activeMnemonic: string | null;
    /** The salt hex used to derive the cached keys */
    activeSaltHex: string | null;

    /** The user ID whose sync pointer is currently loaded. */
    syncUserId: string | null;

    setSyncing: (v: boolean) => void;
    setOnline: (v: boolean) => void;
    setLastSyncAt: (d: Date) => void;
    setSyncError: (e: string | null) => void;
    setDerivedKeys: (mnemonic: string | null, saltHex: string | null, keys: { masterKey: Buffer; notesKey: Buffer; filesKey: Buffer } | null) => void;
    clearDerivedKeys: () => void;
    forceSync: () => Promise<void>;
    /** Hydrate lastSyncAt from persistent storage for the given user. */
    loadLastSyncAt: (userId: string) => Promise<void>;
    /** Clear all in-memory sync state (does NOT touch storage). */
    reset: () => void;
    /** Clear sync pointer from both memory and persistent storage for a specific user. */
    resetForUser: (userId: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
    isSyncing: false,
    isOnline: true, // Optimistic default
    lastSyncAt: null,
    syncError: null,
    derivedMasterKey: null,
    notesKey: null,
    filesKey: null,
    activeMnemonic: null,
    activeSaltHex: null,
    syncUserId: null,

    setSyncing: (isSyncing) => set({ isSyncing }),
    setOnline: (isOnline) => set({ isOnline }),
    setLastSyncAt: (lastSyncAt) => {
        set({ lastSyncAt, syncError: null });
        // Persist to storage under the user-scoped key
        const { syncUserId } = get();
        if (syncUserId) {
            storage.setItem(getSyncTimeKey(syncUserId), lastSyncAt.toISOString());
        }
    },
    setSyncError: (syncError) => set({ syncError }),
    setDerivedKeys: (activeMnemonic, activeSaltHex, keys) => set({
        activeMnemonic,
        activeSaltHex,
        derivedMasterKey: keys ? keys.masterKey : null,
        notesKey: keys ? keys.notesKey : null,
        filesKey: keys ? keys.filesKey : null,
    }),
    clearDerivedKeys: () => set({
        activeMnemonic: null,
        activeSaltHex: null,
        derivedMasterKey: null,
        notesKey: null,
        filesKey: null,
    }),
    forceSync: async () => {
        // Lazy require breaks the cycle!
        const { SyncScheduler } = await import('../sync/sync-scheduler');

        if (SyncScheduler.instance) {
            const state = get();
            if (!state.isOnline) {
                throw new Error("Cannot sync while offline");
            }
            set({ syncError: null });
            await SyncScheduler.instance.forceSync();
        } else {
            console.warn('[SyncStore] SyncScheduler instance not available for forceSync');
            throw new Error("Sync service is not initialized");
        }
    },

    loadLastSyncAt: async (userId: string) => {
        const raw = await storage.getItem(getSyncTimeKey(userId));
        let parsed: Date | null = null;
        if (raw) {
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) parsed = d;
            } catch { /* ignore */ }
        }
        set({ lastSyncAt: parsed, syncUserId: userId });
    },

    reset: () => {
        set({
            isSyncing: false,
            lastSyncAt: null,
            syncError: null,
            derivedMasterKey: null,
            notesKey: null,
            filesKey: null,
            activeMnemonic: null,
            activeSaltHex: null,
            syncUserId: null,
        });
    },

    resetForUser: async (userId: string) => {
        await storage.removeItem(getSyncTimeKey(userId));
        set({
            isSyncing: false,
            lastSyncAt: null,
            syncError: null,
            derivedMasterKey: null,
            notesKey: null,
            filesKey: null,
            activeMnemonic: null,
            activeSaltHex: null,
            syncUserId: null,
        });
        console.log(`[SyncStore] Cleared sync pointer for user ${userId}`);
    },
}));
