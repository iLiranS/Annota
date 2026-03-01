import { authApi } from '@/lib/api/auth.api';
import { userApi } from '@/lib/api/user.api';
import { userService } from '@/lib/services/user.service';
import { getMasterKey } from '@/lib/utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type UserState = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    initialized: boolean;
    /** Cached key_validator hash from Supabase profiles (non-persisted). */
    keyValidator: string | null;
    /** Whether fetchKeyValidator has already run for this session. */
    keyValidatorFetched: boolean;
    /** Cached user role from Supabase (non-persisted). */
    role: string | null;
    /** Whether getUserRole has already run for this session. */
    roleFetched: boolean;
    /** Cached display name from Supabase (non-persisted). */
    displayName: string | null;
    /** Whether getDisplayName has already run for this session. */
    displayNameFetched: boolean;
    setSession: (session: Session | null) => void;
    setGuest: (guest: boolean) => void;
    signOut: () => Promise<void>;
    /** Fetch key_validator from Supabase once, caching the result. */
    fetchKeyValidator: (userId: string) => Promise<string | null>;
    updateDisplayName: (displayName: string) => Promise<void>;
    getDisplayName: () => Promise<string | null>;
    getUserRole: () => Promise<string | null>;

    /** Tracks if the master key is present on the device */
    hasMasterKey: boolean | null;
    setHasMasterKey: (hasKey: boolean) => void;
    checkMasterKey: () => Promise<boolean>;
};

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            session: null as Session | null,
            user: null as User | null,
            isGuest: false,
            initialized: false,
            keyValidator: null,
            keyValidatorFetched: false,
            role: null,
            roleFetched: false,
            displayName: null,
            displayNameFetched: false,
            hasMasterKey: null,

            setHasMasterKey: (hasKey: boolean) => set({ hasMasterKey: hasKey }),

            checkMasterKey: async () => {
                const state = get();
                if (!state.user) return false;
                const key = await getMasterKey(state.user.id);
                set({ hasMasterKey: !!key });
                return !!key;
            },

            setSession: (session) =>
                set((state) => ({
                    session,
                    user: session?.user || null,
                    // If no session is provided, preserve the current guest state
                    // If session is provided, user is authenticated so they are no longer a guest.
                    isGuest: session ? false : state.isGuest,
                    initialized: true,
                    displayName: null,
                    displayNameFetched: false,
                    role: null,
                    roleFetched: false,
                    keyValidator: null,
                    keyValidatorFetched: false,
                    hasMasterKey: session ? state.hasMasterKey : null,
                })),

            setGuest: (isGuest) =>
                set({
                    isGuest,
                    initialized: true,
                    session: null,
                    user: null,
                    displayName: null,
                    displayNameFetched: false,
                }),

            signOut: async () => {
                await authApi.signOut();
                set({ session: null, user: null, isGuest: false, keyValidator: null, keyValidatorFetched: false, role: null, roleFetched: false, displayName: null, displayNameFetched: false, hasMasterKey: null });
            },

            fetchKeyValidator: async (userId: string): Promise<string | null> => {
                const state = get();
                if (state.keyValidatorFetched) return state.keyValidator;

                const validator = await userApi.getKeyValidator(userId);
                set({ keyValidator: validator, keyValidatorFetched: true });
                return validator;
            },

            updateDisplayName: async (displayName: string) => {
                const { user } = get();
                if (!user) return;

                await userService.updateDisplayName(user.id, displayName);

                set((state) => ({
                    displayName,
                    displayNameFetched: true,
                    user: state.user ? {
                        ...state.user,
                        user_metadata: {
                            ...state.user.user_metadata,
                            display_name: displayName,
                        },
                    } : null,
                }));
            },
            getDisplayName: async () => {
                const state = get();
                if (!state.user) return null;
                if (state.displayNameFetched) return state.displayName;

                const name = await userService.getDisplayName(state.user.id);
                set({ displayName: name, displayNameFetched: true });
                return name;
            },
            getUserRole: async () => {
                const state = get();
                if (!state.user) return null;
                if (state.roleFetched) return state.role;

                const role = await userService.getUserRole(state.user.id);
                set({ role, roleFetched: true });
                return role;
            },

        }),
        {
            name: 'auth-storage', // Kept for backwards compatibility with existing local installations
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ isGuest: state.isGuest }),
        }
    )
);
