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

    /** Fetch the user's profile to get the key_validator */
    getKeyValidator: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('key_validator')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.key_validator as string | null;
    },

    /** Update the user's profile key_validator */
    updateKeyValidator: async (userId: string, keyValidator: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ key_validator: keyValidator })
            .eq('id', userId);

        if (error) throw error;
    },


    /** Delete all of the user's encrypted data from the remote database (used when resetting keys) */
    wipeEncryptedData: async (userId: string) => {
        // Calls the RPC with delete_user = false
        const { error } = await supabase.rpc('wipe_user_data', {
            user_id_param: userId,
            delete_user: false
        });

        if (error) {
            console.error('[StorageAPI] Failed to wipe encrypted data:', error);
            throw error;
        }
    },

    deleteUserAccount: async (userId: string) => {
        // Calls the RPC with delete_user = true
        const { error } = await supabase.rpc('wipe_user_data', {
            user_id_param: userId,
            delete_user: true
        });

        if (error) {
            console.error('[StorageAPI] Failed to delete user account:', error);
            throw error;
        }

        // Clean up the local auth session after the database nukes the account
        await supabase.auth.signOut();
    },

    /** Check if the user has any encrypted data in the cloud */
    hasMasterKey: async (userId: string): Promise<boolean> => {
        const { data, error } = await supabase
            .from('profiles')
            .select('key_validator')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.key_validator !== null;
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
