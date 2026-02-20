import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    initialized: boolean;
    setSession: (session: Session | null) => void;
    setGuest: (guest: boolean) => void;
    signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    isGuest: false,
    initialized: false,

    setSession: (session) =>
        set({
            session,
            user: session?.user || null,
            isGuest: false,
            initialized: true,
        }),

    setGuest: (isGuest) =>
        set({
            isGuest,
            initialized: true,
            session: null,
            user: null,
        }),

    signOut: async () => {
        await supabase.auth.signOut();
        set({ session: null, user: null, isGuest: false });
    },
}));
