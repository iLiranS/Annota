import { getDb as getInjectedDb } from '../db/runtime';
import type { DbType } from '../db/types';
import { create } from 'zustand';

interface DbState {
    nativeDb: unknown | null;
    db: unknown | null;
    currentUserId: string | null;
    isGuest: boolean;
    isReady: boolean;

    initDB: (userId: string | null, nativeDb?: unknown) => void;
    resetDB: () => void;
}

export const useDbStore = create<DbState>((set, get) => ({
    nativeDb: null,
    db: null,
    currentUserId: null,
    isGuest: false,
    isReady: false,

    initDB: (userId, nativeDb) => {
        try {
            const db = getInjectedDb();
            set({
                nativeDb: nativeDb ?? get().nativeDb,
                db,
                currentUserId: userId,
                isGuest: !userId,
                isReady: true,
            });
        } catch (error) {
            console.error('[DB Provider] Initialization failed:', error);
            throw error;
        }
    },

    resetDB: () => {
        set({
            nativeDb: null,
            db: null,
            currentUserId: null,
            isGuest: false,
            isReady: false,
        });
    },
}));

export const getDb = <T = DbType>() => {
    return getInjectedDb<T>();
};

export const getExpoDb = <T = any>() => {
    const { nativeDb } = useDbStore.getState();
    if (!nativeDb) throw new Error('Database not initialized');
    return nativeDb as T;
};
