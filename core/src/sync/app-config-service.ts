import { syncApi } from '../api/sync.api';
import { areAdaptersInitialized, getPlatformAdapters } from '../adapters';
import { SyncScheduler } from './sync-scheduler';

const APP_CONFIG_CACHE_KEY = 'annota_app_config_cache';

export const appConfigService = {
    /**
     * Initialize app config: load from cache, then fetch fresh from remote.
     */
    init: async () => {
        // 1. Load from cache if adapters are ready
        if (areAdaptersInitialized()) {
            try {
                const adapters = getPlatformAdapters();
                const cached = await adapters.secureStore.getItem(APP_CONFIG_CACHE_KEY);
                if (cached) {
                    const config = JSON.parse(cached);
                    SyncScheduler.setSyncDisabled(!!config.sync_disabled);
                    console.log('[AppConfigService] Applied cached config:', config);
                }
            } catch (err) {
                console.error('[AppConfigService] Failed to load cached config:', err);
            }
        }

        // 2. Fetch fresh from Supabase
        try {
            const config = await syncApi.getAppConfig();
            if (config) {
                SyncScheduler.setSyncDisabled(!!config.sync_disabled);
                console.log('[AppConfigService] Applied fresh config:', config);
                
                // Cache it for next startup
                if (areAdaptersInitialized()) {
                    const adapters = getPlatformAdapters();
                    await adapters.secureStore.setItem(APP_CONFIG_CACHE_KEY, JSON.stringify(config));
                }
            }
        } catch (err) {
            console.error('[AppConfigService] Failed to fetch fresh config:', err);
        }
    }
};
