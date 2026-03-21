import * as dbClient from './client';
import * as schema from './schema';

export { getDb, initDb, resetDb } from './runtime';
// AsyncDbDriver has been removed.
export { CREATE_TABLES_SQL } from './client';

export async function initDatabase(expoDb: any, drizzleDb: any): Promise<void> {
    await dbClient.initDatabase(expoDb, drizzleDb);
}

export async function resetAll(): Promise<void> {
    await dbClient.resetAll();
}

export async function vacuumDatabase(): Promise<void> {
    await dbClient.vacuumDatabase();
}

export async function purgeGuestTombstones(): Promise<void> {
    await dbClient.purgeGuestTombstones();
}

export async function resetMasterKey(userId: string): Promise<void> {
    await dbClient.resetMasterKey(userId);
}


export * from './repositories/files.repository';
export * from './repositories/folders.repository';
export * from './repositories/notes.repository';
export * from './repositories/tags.repository';
export * from './repositories/tasks.repository';
export * from './types';
export * from './validators/folders';
export * from './validators/image';
export * from './validators/notes';
export * from './validators/tasks';
export { schema };

