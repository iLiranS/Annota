import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { BaseSQLiteDatabase, SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

export type Schema = typeof schema;
export type DbType = BaseSQLiteDatabase<any, any, Schema, ExtractTablesWithRelations<Schema>>;
export type TxType = SQLiteTransaction<any, any, Schema, ExtractTablesWithRelations<Schema>>;

export type DbOrTx = DbType | TxType;
