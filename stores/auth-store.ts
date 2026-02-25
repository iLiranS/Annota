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
    /** Cached key_validator hash from Supabase profiles (non-persisted). */
    keyValidator: string | null;
    /** Whether fetchKeyValidator has already run for this session. */
    keyValidatorFetched: boolean;
    setSession: (session: Session | null) => void;
    setGuest: (guest: boolean) => void;
    signOut: () => Promise<void>;
    /** Fetch key_validator from Supabase once, caching the result. */
    fetchKeyValidator: (userId: string) => Promise<string | null>;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            session: null as Session | null,
            user: null as User | null,
            isGuest: false,
            initialized: false,
            keyValidator: null,
            keyValidatorFetched: false,

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
                set({ session: null, user: null, isGuest: false, keyValidator: null, keyValidatorFetched: false });
            },

            fetchKeyValidator: async (userId: string): Promise<string | null> => {
                const state = get();
                if (state.keyValidatorFetched) return state.keyValidator;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('key_validator')
                    .eq('id', userId)
                    .single();

                const validator = (profile?.key_validator as string) || null;
                set({ keyValidator: validator, keyValidatorFetched: true });
                return validator;
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ isGuest: state.isGuest }),
        }
    )
);
