import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { areAdaptersInitialized } from '../adapters';
import { authApi } from '../api/auth.api';
import { userService } from '../services/user.service';
import { getMasterKey } from '../utils/crypto';
import { createStorageAdapter } from './config';

export type UserRole = string | null;

type UserState = {
    session: Session | null;
    user: User | null;
    isGuest: boolean;
    initialized: boolean;
    /** Cached salt (hex) from Supabase profiles (persisted). */
    saltHex: string | null;
    /** Cached user role from Supabase (non-persisted). */
    role: UserRole;
    /** Cached user sub_exp_date from Supabase (non-persisted). */
    sub_exp_date: string | null;
    /** Whether getUserRole has already run for this session. */
    roleFetched: boolean;
    /** Cached display name from Supabase (non-persisted). */
    displayName: string | null;
    /** Whether getDisplayName has already run for this session. */
    displayNameFetched: boolean;
    /** Total storage used in bytes. */
    storage_used_bytes: number;
    /** Profile creation timestamp. */
    created_at: string | null;
    /** Profile last update timestamp. */
    updated_at: string | null;
    getUserProfile: () => Promise<any>;
    setSession: (session: Session | null) => void;
    setGuest: (guest: boolean) => void;
    signOut: () => Promise<void>;
    updateDisplayName: (displayName: string) => Promise<void>;
    getDisplayName: () => Promise<string | null>;
    getUserRole: () => Promise<UserRole>;
    deleteAccount: () => Promise<void>;

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
            saltHex: null,
            role: null,
            sub_exp_date: null,
            roleFetched: false,
            displayName: null,
            displayNameFetched: false,
            storage_used_bytes: 0,
            created_at: null,
            updated_at: null,
            hasMasterKey: null,

            getUserProfile: async () => {
                const state = get();
                if (!state.user) return null;

                try {
                    const profile = await userService.getUserProfile(state.user.id);
                    if (profile) {
                        set({
                            displayName: profile.display_name,
                            displayNameFetched: true,
                            role: profile.role,
                            roleFetched: true,
                            saltHex: profile.salt ?? null,
                            sub_exp_date: profile.sub_exp_date,
                            storage_used_bytes: profile.storage_used_bytes || 0,
                            created_at: profile.created_at,
                            updated_at: profile.updated_at,
                        });
                    }
                    return profile;
                } catch (e) {
                    console.warn('[user.store] getUserProfile failed (offline likely):', e);
                    return null;
                }
            },

            setHasMasterKey: (hasKey: boolean) => set({ hasMasterKey: hasKey }),

            checkMasterKey: async () => {
                const state = get();
                if (!state.user) return false;

                if (!areAdaptersInitialized()) {
                    return false;
                }

                try {
                    const key = await getMasterKey(state.user.id);
                    set({ hasMasterKey: !!key });
                    return !!key;
                } catch (e) {
                    console.warn('[user.store] checkMasterKey failed (bootstrapping?):', e);
                    return false;
                }
            },

            setSession: (session) =>
                set((state) => {
                    const isSameUser = state.user?.id === session?.user?.id;
                    return {
                        session,
                        user: session?.user || null,
                        // If no session is provided, preserve the current guest state
                        // If session is provided, user is authenticated so they are no longer a guest.
                        isGuest: session ? false : state.isGuest,
                        initialized: true,
                        displayName: isSameUser ? state.displayName : null,
                        displayNameFetched: isSameUser ? state.displayNameFetched : false,
                        role: isSameUser ? state.role : null,
                        sub_exp_date: isSameUser ? state.sub_exp_date : null,
                        roleFetched: isSameUser ? state.roleFetched : false,
                        saltHex: isSameUser ? state.saltHex : null,
                        storage_used_bytes: isSameUser ? state.storage_used_bytes : 0,
                        created_at: isSameUser ? state.created_at : null,
                        updated_at: isSameUser ? state.updated_at : null,
                        hasMasterKey: session ? state.hasMasterKey : null,
                    };
                }),

            setGuest: (isGuest) =>
                set({
                    isGuest,
                    initialized: true,
                    session: null,
                    user: null,
                    displayName: null,
                    displayNameFetched: false,
                    saltHex: null,
                }),

            signOut: async () => {
                await authApi.signOut();
                set({ session: null, user: null, isGuest: false, saltHex: null, role: null, roleFetched: false, displayName: null, displayNameFetched: false, hasMasterKey: null });
            },

            updateDisplayName: async (displayName: string) => {
                const { user } = get();
                if (!user) return;

                try {
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
                } catch (e) {
                    console.error('[user.store] updateDisplayName failed:', e);
                    throw e; // We want to throw here because this is a user action
                }
            },
            getDisplayName: async () => {
                const state = get();
                if (!state.user) return null;
                if (state.displayNameFetched) return state.displayName;

                try {
                    const name = await userService.getDisplayName(state.user.id);
                    set({ displayName: name, displayNameFetched: true });
                    return name;
                } catch (e) {
                    console.warn('[user.store] failed to get display name (offline likely):', e);
                    // On error, we just return the cached displayName from state instead of throwing
                    return state.displayName;
                }
            },
            getUserRole: async () => {
                const state = get();
                if (!state.user) return null;
                if (state.roleFetched) return state.role;

                try {
                    const role = await userService.getUserRole(state.user.id);
                    set({ role, roleFetched: true });
                    return role;
                } catch (e) {
                    console.warn('[user.store] getUserRole failed (offline likely):', e);
                    return state.role;
                }
            },
            getSubscriptionExpiryDate: async () => {
                const state = get();
                if (!state.user) return null;
                if (state.sub_exp_date) return state.sub_exp_date;

                try {
                    const sub_exp_date = await userService.getSubscriptionExpiryDate(state.user.id);
                    set({ sub_exp_date });
                    return sub_exp_date;
                } catch (e) {
                    console.warn('[user.store] getSubscriptionExpiryDate failed (offline likely):', e);
                    return state.sub_exp_date;
                }
            },
            deleteAccount: async () => {
                const { user } = get();
                if (!user) return;

                try {
                    // 1. Delete all associated files from filesystem
                    // Using dynamic imports to avoid circular dependencies with db client
                    const { getAllFilePaths } = await import('../db/repositories/files.repository');
                    const filePaths = await getAllFilePaths();
                    const { getPlatformAdapters } = await import('../adapters');
                    const platform = getPlatformAdapters();

                    for (const path of filePaths) {
                        try {
                            await platform.fileSystem.deleteFile(path);
                        } catch (e) {
                            console.warn(`[user.store] Failed to delete file at ${path}:`, e);
                        }
                    }

                    // 2. Delete the local SQL database tables
                    const { deleteDatabase } = await import('../db/client');
                    await deleteDatabase();

                    // 3. Delete the account from Supabase
                    await userService.deleteAccount();
                } catch (e) {
                    console.error('[user.store] Error during account deletion cleanup:', e);
                    // We continue to reset the store anyway to ensure the user is logged out locally
                }

                set({
                    session: null,
                    user: null,
                    isGuest: false,
                    saltHex: null,
                    role: null,
                    roleFetched: false,
                    displayName: null,
                    displayNameFetched: false,
                    storage_used_bytes: 0,
                    created_at: null,
                    updated_at: null,
                    hasMasterKey: null
                });
            },

        }),
        {
            name: 'auth-storage', // Kept for backwards compatibility with existing local installations
            storage: createJSONStorage(() => createStorageAdapter()),
            skipHydration: true,
            partialize: (state) => ({
                isGuest: state.isGuest,
                displayName: state.displayName,
                user: state.user,
                hasMasterKey: state.hasMasterKey,
                role: state.role,
                sub_exp_date: state.sub_exp_date,
                saltHex: state.saltHex,
                storage_used_bytes: state.storage_used_bytes,
                created_at: state.created_at,
                updated_at: state.updated_at
            } as any),
            onRehydrateStorage: () => {
                return (_state, error) => {
                    if (!error) {
                        useUserStore.setState({ initialized: true });
                    }
                };
            },
        }
    )
);
