import { initDatabase } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

type ExpoDbInstance = ReturnType<typeof drizzle<typeof schema>>;

interface DbState {
    expoDb: SQLiteDatabase | null;
    db: ExpoDbInstance | null;
    currentUserId: string | null;
    isGuest: boolean;
    isReady: boolean;

    initDB: (userId: string | null) => void;
}

export const useDbStore = create<DbState>((set, get) => ({
    expoDb: null,
    db: null,
    currentUserId: null,
    isGuest: false,
    isReady: false,

    initDB: (userId) => {
        try {
            const isGuest = !userId;
            let dbName = 'local_guest.db';
            if (userId) {
                dbName = `user_${userId}.db`;
            }

            console.log(`[DB Provider] Initializing database: ${dbName}`);

            const expoDb = openDatabaseSync(dbName);
            const drizzleDb = drizzle(expoDb, { schema });

            // Run migrations and seed data
            initDatabase(expoDb, drizzleDb as any); // Typings fix on client side later

            set({
                expoDb,
                db: drizzleDb,
                currentUserId: userId,
                isGuest,
                isReady: true,
            });

            console.log(`[DB Provider] Connected to ${dbName}`);
        } catch (error) {
            console.error('[DB Provider] Initialization failed:', error);
            throw error;
        }
    }
}));

export const getDb = () => {
    const { db } = useDbStore.getState();
    if (!db) throw new Error('Database not initialized');
    return db;
};

export const getExpoDb = () => {
    const { expoDb } = useDbStore.getState();
    if (!expoDb) throw new Error('Database not initialized');
    return expoDb;
};
