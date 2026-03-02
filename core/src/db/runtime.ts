import type { DbType } from './types';

let dbInstance: DbType | null = null;

export const initDb = (drizzleDb: DbType): void => {
    dbInstance = drizzleDb;
};

export const getDb = <T = DbType>(): T => {
    if (!dbInstance) {
        throw new Error('Database not initialized!');
    }
    return dbInstance as T;
};

export const resetDb = (): void => {
    dbInstance = null;
};
