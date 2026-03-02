import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

export type DbType = ExpoSQLiteDatabase<typeof import('./schema')>;
export type TxType = Parameters<Parameters<DbType['transaction']>[0]>[0];
export type DbOrTx = DbType | TxType;
