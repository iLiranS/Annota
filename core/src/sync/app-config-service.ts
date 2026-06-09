import { areAdaptersInitialized, getPlatformAdapters } from '../adapters';
import { syncApi } from '../api/sync.api';
import { SyncScheduler } from './sync-scheduler';
import { useSyncStore } from '../stores/sync.store';

const APP_CONFIG_CACHE_KEY = 'annota_app_config_cache';

let configFetched = false;
let activeConfigPromise: Promise<any> | null = null;

export const appConfigService = {
    /**
     * Initialize app config: load from cache, then fetch fresh from remote.
     */
    init: async (force?: boolean) => {
        // 1. Load from cache if adapters are ready
        if (areAdaptersInitialized()) {
            try {
                const adapters = getPlatformAdapters();
                const cached = await adapters.secureStore.getItem(APP_CONFIG_CACHE_KEY);
                if (cached) {
                    const config = JSON.parse(cached);
                    SyncScheduler.setSyncDisabled(!!config.sync_disabled);
                }
            } catch (err) {
                console.error('[AppConfigService] Failed to load cached config:', err);
            }
        }

        // If already fetched in this session and not forcing refresh, skip remote call
        if (configFetched && !force) {
            return;
        }

        // Deduplicate in-flight remote configuration requests
        if (activeConfigPromise && !force) {
            return activeConfigPromise;
        }

        // 2. Fetch fresh from Supabase if online
        if (useSyncStore.getState().isOnline) {
            activeConfigPromise = (async () => {
                try {
                    const config = await syncApi.getAppConfig();
                    if (config) {
                        SyncScheduler.setSyncDisabled(!!config.sync_disabled);
                        configFetched = true;

                        // Cache it for next startup
                        if (areAdaptersInitialized()) {
                            const adapters = getPlatformAdapters();
                            await adapters.secureStore.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify(config));
                        }
                    }
                } catch (err) {
                    console.error('[AppConfigService] Failed to fetch fresh config:', err);
                } finally {
                    activeConfigPromise = null;
                }
            })();

            return activeConfigPromise;
        }
    }
};
