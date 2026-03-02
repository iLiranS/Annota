import { supabase } from '../supabase';

// Helper type based on what the sync uses
export type SyncPayload = {
    folders: any[];
    tasks: any[];
    notes: any[];
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
    }
};
