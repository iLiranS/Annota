import { supabase } from '../supabase';

// Helper type based on what the sync uses
export type SyncPayload = {
    folders: any[];
    tasks: any[];
    notes: any[];
    tags: any[];
};

export const syncApi = {
    /** Pull all sync data via the remote RPC function */
    pullSyncData: async (lastSync: string) => {
        return await supabase.rpc('pull_sync_data', {
            p_last_sync: lastSync,
        });
    },

    /** Upsert encrypted folders */
    upsertFolders: async (folders: any[]) => {
        return await supabase.from('encrypted_folders').upsert(folders);
    },

    /** Upsert encrypted tasks */
    upsertTasks: async (tasks: any[]) => {
        return await supabase.from('encrypted_tasks').upsert(tasks);
    },

    /** Upsert encrypted tags */
    upsertTags: async (tags: any[]) => {
        return await supabase.from('encrypted_tags').upsert(tags);
    },

    /** Upsert encrypted notes */
    upsertNotes: async (notes: any[]) => {
        return await supabase.from('encrypted_notes').upsert(notes);
    },

    /** Fetch deleted IDs after a given timestamp */
    getDeletedIds: async (lastSync: string) => {
        return await supabase
            .from('deleted_records')
            .select('record_id, deleted_at, table_name')
            .gt('deleted_at', lastSync);
    },

    /** Fetch server time to sync clocks */
    getServerTime: async () => {
        const { data, error } = await supabase.rpc('get_server_time');
        if (error) throw error;
        return new Date(data || new Date().toISOString());
    },

    /** Fetch remote app configuration */
    getAppConfig: async () => {
        try {
            // 1. Get the public URL for the file (this doesn't make a network request, just formats the string)
            const { data } = supabase.storage.from('app-config').getPublicUrl('flags.json');

            if (!data?.publicUrl) {
                throw new Error("Could not generate public URL");
            }

            // 2. Fetch directly. We add a cache-busting query param or header 
            // to ensure edge caches don't serve a stale kill-switch when you need it most.
            const response = await fetch(data.publicUrl, {
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const config = await response.json();
            return config as { sync_disabled: boolean };

        } catch (err) {
            console.error('[SyncApi] Failed to fetch app config:', err);
            // Fail gracefully: If the network is down or the file is missing, 
            // assume sync is NOT disabled so the app keeps functioning normally.
            return { sync_disabled: false };
        }
    }
};
