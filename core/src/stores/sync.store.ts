import { Buffer } from 'buffer';
import { create } from 'zustand';
import { createStorageAdapter } from './config';

export interface SyncCursor {
    time: string;
    id: string;
}

export interface SyncCursors {
    notes: SyncCursor | null;
    folders: SyncCursor | null;
    tags: SyncCursor | null;
}

const getSyncTimeKey = (userId: string) => `${userId}_last_sync_time`;
const storage = createStorageAdapter();


interface SyncState {
    /** Lock to prevent overlapping push/pull operations */
    isSyncing: boolean;
    /** Mirrors NetInfo connectivity */
    isOnline: boolean;
    /** Multi-cursor state for resuming syncs */
    syncCursors: SyncCursors | null;
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
    /** Whether re-authentication is required (e.g. 401 error) */
    authRequired: boolean;
    /** ISO timestamp of the last successful sync completion */
    lastSyncTime: string | null;

    setSyncing: (v: boolean) => void;
    setOnline: (v: boolean) => void;
    updateSyncCursors: (cursors: Partial<SyncCursors>) => void;
    setSyncError: (e: string | null) => void;
    setAuthRequired: (v: boolean) => void;
    setLastSyncTime: (time: string | null) => void;
    setDerivedKeys: (mnemonic: string | null, saltHex: string | null, keys: { masterKey: Buffer; notesKey: Buffer; filesKey: Buffer } | null) => void;
    clearDerivedKeys: () => void;
    forceSync: () => Promise<void>;
    /** Hydrate cursors from persistent storage for the given user. */
    loadSyncCursors: (userId: string) => Promise<void>;
    /** Clear all in-memory sync state (does NOT touch storage). */
    reset: () => void;
    /** Clear sync pointer from both memory and persistent storage for a specific user. */
    resetForUser: (userId: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
    isSyncing: false,
    isOnline: true, // Optimistic default
    syncCursors: null,
    syncError: null,
    derivedMasterKey: null,
    notesKey: null,
    filesKey: null,
    activeMnemonic: null,
    activeSaltHex: null,
    syncUserId: null,
    authRequired: false,
    lastSyncTime: null,

    setSyncing: (isSyncing) => set({ isSyncing }),
    setOnline: (isOnline) => set({ isOnline }),
    updateSyncCursors: (newCursors) => {
        const { syncCursors, syncUserId } = get();
        const updated = {
            notes: newCursors.notes !== undefined ? newCursors.notes : syncCursors?.notes || null,
            folders: newCursors.folders !== undefined ? newCursors.folders : syncCursors?.folders || null,
            tags: newCursors.tags !== undefined ? newCursors.tags : syncCursors?.tags || null,
        };
        set({ syncCursors: updated, syncError: null });
        if (syncUserId) {
            storage.setItem(getSyncTimeKey(syncUserId), JSON.stringify(updated));
        }
    },
    setSyncError: (syncError) => set({ syncError }),
    setAuthRequired: (authRequired) => set({ authRequired }),
    setLastSyncTime: (lastSyncTime) => {
        const { syncUserId } = get();
        set({ lastSyncTime });
        if (syncUserId && lastSyncTime) {
            storage.setItem(`${syncUserId}_last_sync_completed_at`, lastSyncTime);
        }
    },
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

    loadSyncCursors: async (userId: string) => {
        const raw = await storage.getItem(getSyncTimeKey(userId));
        let parsed: SyncCursors | null = null;
        if (raw) {
            try {
                parsed = JSON.parse(raw);
            } catch { /* ignore */ }
        }
        const rawTime = await storage.getItem(`${userId}_last_sync_completed_at`);
        set({ syncCursors: parsed, syncUserId: userId, lastSyncTime: rawTime || null });
    },

    reset: () => {
        set({
            isSyncing: false,
            syncCursors: null,
            syncError: null,
            derivedMasterKey: null,
            notesKey: null,
            filesKey: null,
            activeMnemonic: null,
            activeSaltHex: null,
            syncUserId: null,
            authRequired: false,
            lastSyncTime: null,
        });
    },

    resetForUser: async (userId: string) => {
        await storage.removeItem(getSyncTimeKey(userId));
        await storage.removeItem(`${userId}_last_sync_completed_at`);
        set({
            isSyncing: false,
            syncCursors: null,
            syncError: null,
            derivedMasterKey: null,
            notesKey: null,
            filesKey: null,
            activeMnemonic: null,
            activeSaltHex: null,
            syncUserId: null,
            authRequired: false,
            lastSyncTime: null,
        });
        console.log(`[SyncStore] Cleared sync pointer for user ${userId}`);
    },
}));
