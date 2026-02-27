import { supabase } from '@/lib/supabase';

export const userApi = {
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
        const promises = [
            supabase.from('encrypted_notes').delete().eq('user_id', userId),
            supabase.from('encrypted_tasks').delete().eq('user_id', userId),
            supabase.from('encrypted_folders').delete().eq('user_id', userId)
        ];

        const results = await Promise.all(promises);

        for (const res of results) {
            if (res.error) throw res.error;
        }
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
        console.log('Getting user role for user:', userId);
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data?.role as string | null;
    },
};
