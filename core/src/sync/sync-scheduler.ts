import { getPlatformAdapters, type Unsubscribe } from '../adapters';
import { useSyncStore } from '../stores/sync.store';
import { syncPullRaw as syncPull, syncPushRaw as syncPush } from './sync-service';

const DEBOUNCE_MS = 10_000;       // 10 seconds of idle → push
const HARD_MAX_MS = 2 * 60_000;   // 2 minutes absolute cap
const OFFLINE_TOAST_COOLDOWN_MS = 30_000; // Don't spam offline toast

/**
 * Singleton that owns all sync scheduling logic:
 * - 10 s debounce after content changes
 * - 2 min hard-max timer
 * - AppState flush on background
 * - NetInfo connectivity awareness
 * - Overlap prevention via isSyncing lock
 */
export class SyncScheduler {
    static instance: SyncScheduler | null = null;

    private masterKey: string = '';
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private hardMaxTimer: ReturnType<typeof setTimeout> | null = null;
    private appStateUnsubscribe: Unsubscribe | null = null;
    private netInfoUnsubscribe: Unsubscribe | null = null;
    private lastOfflineToastAt = 0;
    private disposed = false;

    // ─── Public API ────────────────────────────────────────────

    init(masterKey: string): void {
        this.masterKey = masterKey;
        this.disposed = false;
        SyncScheduler.instance = this;

        const adapters = getPlatformAdapters();

        // Subscribe to AppState
        this.appStateUnsubscribe = adapters.appState.subscribe(
            this.handleAppStateChange,
        );

        // Subscribe to NetInfo
        this.netInfoUnsubscribe = adapters.network.subscribe(
            this.handleNetInfoChange,
        );

        // Initial pull on startup
        this.executeSyncPull();
    }

    /** Called on every note content change — resets the debounce timer */
    notifyContentChange(): void {
        if (this.disposed) return;

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

    /** Manual retry from the UI (toast button / sidebar button) */
    requestImmediateSync(): void {
        if (this.disposed) return;
        this.clearAllTimers();
        this.executeSyncPush();
    }

    dispose(): void {
        this.disposed = true;
        this.clearAllTimers();

        this.appStateUnsubscribe?.();
        this.appStateUnsubscribe = null;

        this.netInfoUnsubscribe?.();
        this.netInfoUnsubscribe = null;

        if (SyncScheduler.instance === this) {
            SyncScheduler.instance = null;
        }
    }

    // ─── Internals ─────────────────────────────────────────────

    private handleAppStateChange = (isActive: boolean): void => {
        if (this.disposed) return;

        // Flush immediately when going to background/inactive
        if (!isActive) {
            console.log('[SyncScheduler] App going to background — flushing changes');
            this.clearAllTimers();
            this.executeSyncPush();
        }
    };

    private handleNetInfoChange = (isOnline: boolean): void => {
        if (this.disposed) return;

        const wasOnline = useSyncStore.getState().isOnline;

        useSyncStore.getState().setOnline(isOnline);

        // Transition: offline → online → drain dirty data
        if (!wasOnline && isOnline) {
            console.log('[SyncScheduler] Back online — syncing');
            this.showOnlineToast();
            this.executeSyncPull().then(() => this.executeSyncPush());
        } else if (wasOnline && !isOnline) {
            console.log('[SyncScheduler] Went offline');
            this.showOfflineToast();
        }
    };

    /**
     * Execute a sync push with overlap prevention and offline guard.
     */
    private async executeSyncPush(): Promise<void> {
        if (this.disposed) return;

        const store = useSyncStore.getState();

        // Overlap lock
        if (store.isSyncing) {
            console.log('[SyncScheduler] Push skipped — sync already in-flight');
            return;
        }

        // Offline guard
        if (!store.isOnline) {
            return;
        }

        store.setSyncing(true);
        try {
            await syncPush(this.masterKey);
            store.setLastSyncAt(new Date());

            // Re-init stores so UI reflects pushed state
            this.reinitStores();

            console.log('[SyncScheduler] Push complete');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown sync error';
            console.error('[SyncScheduler] Push failed:', msg);
            store.setSyncError(msg);
        } finally {
            useSyncStore.getState().setSyncing(false);
        }
    }

    /**
     * Execute a sync pull with overlap prevention and offline guard.
     */
    private async executeSyncPull(): Promise<void> {
        if (this.disposed) return;

        const store = useSyncStore.getState();

        if (store.isSyncing) {
            console.log('[SyncScheduler] Pull skipped — sync already in-flight');
            return;
        }

        if (!store.isOnline) {
            return; // Silent skip for pull — no toast needed
        }

        store.setSyncing(true);
        try {
            await syncPull(this.masterKey);
            store.setLastSyncAt(new Date());

            // Re-init stores so UI reflects pulled data
            this.reinitStores();

            console.log('[SyncScheduler] Pull complete');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown sync error';
            console.error('[SyncScheduler] Pull failed:', msg);
            store.setSyncError(msg);
        } finally {
            useSyncStore.getState().setSyncing(false);
        }
    }

    /**
     * Force a heavy re-init of stores so the UI repaints.
     * Uses dynamic import() to work in both ESM (Vite/desktop) and CJS (Metro/mobile).
     */
    private async reinitStores(): Promise<void> {
        try {
            const [{ useNotesStore }, { useTasksStore }] = await Promise.all([
                import('../stores/notes.store'),
                import('../stores/tasks.store'),
            ]);
            await Promise.all([
                useNotesStore.getState().initApp(),
                useTasksStore.getState().loadTasks(),
            ]);
        } catch (err) {
            console.error('[SyncScheduler] Store reinit failed:', err);
        }
    }

    private showOfflineToast(): void {
        const now = Date.now();
        if (now - this.lastOfflineToastAt < OFFLINE_TOAST_COOLDOWN_MS) return;

        this.lastOfflineToastAt = now;
        getPlatformAdapters().toast.show({
            type: 'info',
            title: 'You\'re offline',
            message: 'Changes are saved locally and will sync when you reconnect.',
        });
    }

    private showOnlineToast(): void {
        getPlatformAdapters().toast.show({
            type: 'info',
            title: 'Back online',
            message: 'Syncing your changes...',
        });
    }

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
