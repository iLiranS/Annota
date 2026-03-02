import * as schema from './schema';
export { getDb, initDb, resetDb } from './runtime';

export function initDatabase(expoDb: any, drizzleDb: any): void {
    const dbClient = require('./client');
    dbClient.initDatabase(expoDb, drizzleDb);
}

export async function resetAll(): Promise<void> {
    const dbClient = require('./client');
    await dbClient.resetAll();
}

export function vacuumDatabase(): void {
    const dbClient = require('./client');
    dbClient.vacuumDatabase();
}

export async function resetMasterKey(userId: string): Promise<void> {
    const dbClient = require('./client');
    await dbClient.resetMasterKey(userId);
}

export { schema };
export * from './repositories/folders.repository';
export * from './repositories/images.repository';
export * from './repositories/notes.repository';
export * from './repositories/tasks.repository';
export * from './schema';
export * from './types';
export * from './validators/folders';
export * from './validators/image';
export * from './validators/notes';
export * from './validators/tasks';
