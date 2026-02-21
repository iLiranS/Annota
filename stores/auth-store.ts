import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AuthState = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    initialized: boolean;
    setSession: (session: Session | null) => void;
    setGuest: (guest: boolean) => void;
    signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            session: null,
            user: null,
            isGuest: false,
            initialized: false,

            setSession: (session) =>
                set((state) => ({
                    session,
                    user: session?.user || null,
                    // If no session is provided, preserve the current guest state
                    // If session is provided, user is authenticated so they are no longer a guest.
                    isGuest: session ? false : state.isGuest,
                    initialized: true,
                })),

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
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ isGuest: state.isGuest }),
        }
    )
);
