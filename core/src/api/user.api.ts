import { supabase } from '../supabase';

export const userApi = {

    getUserProfile: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    /** Update the user's profile salt (hex) */
    updateSalt: async (userId: string, saltHex: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ salt: saltHex })
            .eq('id', userId);

        if (error) throw error;
    },


    /** Delete all of the user's encrypted data from the remote database (used when resetting keys) */
    wipeEncryptedData: async () => {
        const { error } = await supabase.functions.invoke('manage-user-data', {
            body: { action: 'reset_data' }
        });

        if (error) {
            console.error('[StorageAPI] Failed to wipe encrypted data:', error);
            throw error;
        }
    },

    deleteUserAccount: async () => {
        const { error } = await supabase.functions.invoke('manage-user-data', {
            body: { action: 'delete_account' }
        });

        if (error) {
            console.error('[StorageAPI] Failed to delete user account:', error);
            throw error;
        }

        // Clean up the local auth session
        await supabase.auth.signOut();
    },

    /** Check if the user has any encrypted data in the cloud */
    hasEncryptedData: async (userId: string): Promise<boolean> => {
        const tables = ['encrypted_notes', 'encrypted_tasks', 'encrypted_tags', 'encrypted_folders'];
        for (const table of tables) {
            const { data, error } = await supabase
                .from(table)
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            if (error) throw error;
            if (data && data.length > 0) return true;
        }
        return false;
    },

    /** Fetch a single encrypted payload sample for key validation */
    getEncryptedSample: async (userId: string): Promise<{ encrypted_data: string; nonce: string } | null> => {
        const tables = ['encrypted_notes', 'encrypted_tasks', 'encrypted_tags', 'encrypted_folders'];
        for (const table of tables) {
            const { data, error } = await supabase
                .from(table)
                .select('encrypted_data, nonce')
                .eq('user_id', userId)
                .limit(1);

            if (error) throw error;
            if (data && data.length > 0) {
                return { encrypted_data: data[0].encrypted_data, nonce: data[0].nonce };
            }
        }
        return null;
    },

    updateDisplayName: async (userId: string, displayName: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', userId);
        if (error) throw error;
    },
    getDisplayName: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data?.display_name as string | null;
    },
    getUserRole: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data?.role as string | null;
    },
    getSubscriptionExpiryDate: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('sub_exp_date')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data?.sub_exp_date as string | null;
    },
};
