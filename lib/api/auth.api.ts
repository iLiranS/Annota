import { supabase } from '@/lib/supabase';
import { Provider } from '@supabase/supabase-js';

export const authApi = {
    /** Get the current session */
    getSession: async () => {
        return await supabase.auth.getSession();
    },

    /** Sign in with an OAuth provider */
    signInWithOAuth: async (provider: Provider, redirectTo: string) => {
        return await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo,
                skipBrowserRedirect: true,
            },
        });
    },

    /** Exchange an auth code for a session */
    exchangeCodeForSession: async (code: string) => {
        return await supabase.auth.exchangeCodeForSession(code);
    },

    /** Set the session using access and refresh tokens */
    setSession: async (access_token: string, refresh_token: string) => {
        return await supabase.auth.setSession({ access_token, refresh_token });
    },

    /** Sign out the current user */
    signOut: async () => {
        return await supabase.auth.signOut();
    },

    /** Listen to auth state changes */
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
        return subscription;
    },
};
