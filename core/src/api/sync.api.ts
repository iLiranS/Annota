import { isCloudEnabled, supabase } from '../supabase';
import { useUserStore } from '../stores/user.store';

// Helper type based on what the sync uses
export type SyncPayload = {
    folders: any[];
    notes: any[];
    tags: any[];
};

export const syncApi = {
    /** Pull all sync data via the remote RPC function */
    pullSyncData: async (
        p_last_sync: string, p_notes_id: string,
        p_folders_time: string, p_folders_id: string,
        p_tags_time: string, p_tags_id: string
    ) => {
        return await supabase.rpc('pull_sync_data', {
            p_last_sync,
            p_notes_id,
            p_folders_time,
            p_folders_id,
            p_tags_time,
            p_tags_id,
        });
    },

    /** Upsert encrypted folders */
    upsertFolders: async (folders: any[]) => {
        return await supabase.from('encrypted_folders').upsert(folders);
    },


    /** Upsert encrypted tags */
    upsertTags: async (tags: any[]) => {
        return await supabase.from('encrypted_tags').upsert(tags);
    },

    /** Upsert encrypted notes */
    upsertNotes: async (notes: any[]) => {
        return await supabase.from('encrypted_notes').upsert(notes);
    },

    /** Publish a note by upserting its public Markdown representation */
    upsertPublishedNote: async (noteId: string, userId: string, mdData: string, title: string, publishUpdatedAt: Date | string) => {
        return await supabase
            .from('published_notes')
            .upsert({
                note_id: noteId,
                user_id: userId,
                md_data: mdData,
                title: title,
                published_at: typeof publishUpdatedAt === 'string' ? publishUpdatedAt : publishUpdatedAt.toISOString(),
                updated_at: new Date().toISOString()
            });
    },

    /** Unpublish a note by deleting its public representation */
    deletePublishedNote: async (noteId: string) => {
        return await supabase
            .from('published_notes')
            .delete()
            .eq('note_id', noteId);
    },

    /** Fetch deleted IDs after a given timestamp */
    getDeletedIds: async (lastSync: string) => {
        return await supabase
            .from('deleted_records')
            .select('record_id, deleted_at, table_name')
            .gt('deleted_at', lastSync);
    },


    /** Fetch remote app configuration */
    getAppConfig: async () => {
        if (!isCloudEnabled) return { sync_disabled: false };

        const { isGuest, user } = useUserStore.getState();
        if (isGuest || !user) {
            return { sync_disabled: false };
        }

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
