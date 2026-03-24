import { getPlatformAdapters, type Unsubscribe } from '../adapters';
import { useSyncStore } from '../stores/sync.store';
import { syncPull, syncPush } from './sync-service';

const DEBOUNCE_MS = 10_000;       // 10 seconds of idle → push
const HARD_MAX_MS = 2 * 60_000;   // 2 minutes absolute cap
// const OFFLINE_TOAST_COOLDOWN_MS = 30_000; // Don't spam offline toast

export interface SyncDependencies {
    reinitStores: () => Promise<void>;
    getSyncState: () => { isOnline: boolean; syncError: string | null; setOnline: (o: boolean) => void };
}

export class SyncScheduler {
    private static _instance: SyncScheduler | null = null;

    public static get instance(): SyncScheduler | null {
        return SyncScheduler._instance;
    }

    public static getInstance(): SyncScheduler {
        if (!SyncScheduler._instance) {
            SyncScheduler._instance = new SyncScheduler();
        }
        return SyncScheduler._instance;
    }

    private static _syncDisabled = false;
    public static setSyncDisabled(disabled: boolean) {
        SyncScheduler._syncDisabled = disabled;
    }
    public static isSyncDisabled(): boolean {
        return SyncScheduler._syncDisabled;
    }

    private constructor() { }

    private masterKey: string = '';
    private deps: SyncDependencies | null = null;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private hardMaxTimer: ReturnType<typeof setTimeout> | null = null;
    private appStateUnsubscribe: Unsubscribe | null = null;
    private netInfoUnsubscribe: Unsubscribe | null = null;
    // private lastOfflineToastAt = 0;
    private disposed = false;
    private initialized = false;
    private userId: string | null = null;

    // ─── Public API ────────────────────────────────────────────

    init(masterKey: string, deps: SyncDependencies, userId?: string): void {
        if (!userId) {
            console.log('[SyncScheduler] No user ID provided, staying quiet (guest mode)');
            if (this.initialized) {
                this.dispose();
            }
            return;
        }

        // Skip if already initialized with the same key
        if (this.initialized && this.masterKey === masterKey && this.userId === userId && !this.disposed) {
            return;
        }

        console.log('[SyncScheduler] Initializing with master key for user:', userId);
        this.masterKey = masterKey;
        this.userId = userId;
        this.deps = deps;
        this.disposed = false;
        this.initialized = true;

        // Cleanup existing listeners if re-initializing
        this.appStateUnsubscribe?.();
        this.netInfoUnsubscribe?.();

        const adapters = getPlatformAdapters();

        // Subscribe to AppState
        this.appStateUnsubscribe = adapters.appState.subscribe(
            this.handleAppStateChange,
        );

        // Subscribe to NetInfo
        this.netInfoUnsubscribe = adapters.network.subscribe(
            this.handleNetInfoChange,
        );

        // Hydrate the sync pointer from storage, then do the initial pull
        useSyncStore.getState().loadLastSyncAt(userId).then(() => {
            if (!this.disposed) this.executeSyncPull();
        });
    }

    /** Called on every note content change — resets the debounce timer */
    notifyContentChange(): void {
        if (this.disposed || !this.initialized) return;

        // Reset the 10 s debounce
        this.clearDebounce();
        this.debounceTimer = setTimeout(() => {
            this.executeSyncPush();
        }, DEBOUNCE_MS);

        // Start the hard-max timer if not already running
        if (!this.hardMaxTimer) {
            this.hardMaxTimer = setTimeout(() => {
                this.hardMaxTimer = null;
                this.clearDebounce();
                // Pull first (user may be editing on another device), then push
                this.executeSyncPull().then(() => this.executeSyncPush());
            }, HARD_MAX_MS);
        }
    }

    /**
     * Immediate manual sync triggered by the user from the UI.
     * Interrupts scheduled timers, pulls fresh data, pushes local
     * changes, and repaints the UI.
     */
    async forceSync(): Promise<void> {
        if (this.disposed || !this.initialized || !this.deps) return;

        if (SyncScheduler._syncDisabled) {
            console.warn('[SyncScheduler] Force sync ignored: sync is disabled via remote config');
            return;
        }

        console.log('[SyncScheduler] Force sync requested');
        this.clearAllTimers();

        // Execute pull then push sequentially
        await this.executeSyncPull();

        let state = this.deps.getSyncState();
        if (state.syncError) throw new Error(state.syncError);

        await this.executeSyncPush();

        state = this.deps.getSyncState();
        if (state.syncError) throw new Error(state.syncError);
    }

    dispose(): void {
        this.disposed = true;
        this.initialized = false;
        this.userId = null;
        this.clearAllTimers();

        this.appStateUnsubscribe?.();
        this.appStateUnsubscribe = null;

        this.netInfoUnsubscribe?.();
        this.netInfoUnsubscribe = null;
    }

    // ─── Internals ─────────────────────────────────────────────

    private handleAppStateChange = (isActive: boolean): void => {
        if (this.disposed) return;

        // Flush immediately ONLY when going to background/inactive
        // and if there's a pending change (debounce timer is active)
        if (!isActive) {
            if (this.debounceTimer) {
                console.log('[SyncScheduler] App going to background with pending changes — flushing');
                this.clearAllTimers();
                this.executeSyncPush();
            }
        }
    };

    private handleNetInfoChange = (isOnline: boolean): void => {
        if (this.disposed || !this.deps) return;

        const syncState = this.deps.getSyncState();
        const wasOnline = syncState.isOnline;

        syncState.setOnline(isOnline);

        // Transition: offline → online → drain dirty data
        if (!wasOnline && isOnline) {
            console.log('[SyncScheduler] Back online — syncing');
            // this.showOnlineToast();
            this.executeSyncPull().then(() => this.executeSyncPush());
        } else if (wasOnline && !isOnline) {
            console.log('[SyncScheduler] Went offline');
            // this.showOfflineToast();
        }
    };

    /**
     * Execute a sync push with overlap prevention and offline guard.
     */
    private async executeSyncPush(): Promise<boolean> {
        if (this.disposed) return false;

        if (SyncScheduler._syncDisabled) {
            console.log('[SyncScheduler] Push skipped: sync is disabled via remote config');
            return false;
        }

        try {
            const success = await syncPush(this.masterKey);
            if (success) {
                console.log('[SyncScheduler] Push success — reinitializing stores');
                await this.reinitStores();
            }
            return success;
        } catch (err) {
            console.error('[SyncScheduler] Push failed', err);
            return false;
        }
    }

    /**
     * Execute a sync pull with overlap prevention and offline guard.
     */
    private async executeSyncPull(): Promise<boolean> {
        if (this.disposed) return false;

        if (SyncScheduler._syncDisabled) {
            console.log('[SyncScheduler] Pull skipped: sync is disabled via remote config');
            return false;
        }

        try {
            const success = await syncPull(this.masterKey);
            if (success) {
                console.log('[SyncScheduler] Pull success — reinitializing stores');
                await this.reinitStores();
            }
            return success;
        } catch (err) {
            console.error('[SyncScheduler] Pull failed');
            return false;
        }
    }

    /**
     * Force a heavy re-init of stores so the UI repaints.
     */
    private async reinitStores(): Promise<void> {
        if (!this.deps) return;
        try {
            await this.deps.reinitStores();
        } catch (err) {
            console.error('[SyncScheduler] Store reinit failed:', err);
        }
    }

    // private showOfflineToast(): void {
    //     const now = Date.now();
    //     if (now - this.lastOfflineToastAt < OFFLINE_TOAST_COOLDOWN_MS) return;

    //     this.lastOfflineToastAt = now;
    //     getPlatformAdapters().toast.show({
    //         type: 'info',
    //         title: 'You\'re offline',
    //         message: 'Changes are saved locally and will sync when you reconnect.',
    //     });
    // }

    // private showOnlineToast(): void {
    //     getPlatformAdapters().toast.show({
    //         type: 'info',
    //         title: 'Back online',
    //         message: 'Syncing your changes...',
    //     });
    // }

    private clearDebounce(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    private clearAllTimers(): void {
        this.clearDebounce();
        if (this.hardMaxTimer) {
            clearTimeout(this.hardMaxTimer);
            this.hardMaxTimer = null;
        }
    }
}

