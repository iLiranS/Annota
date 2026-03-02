import { eq } from 'drizzle-orm';
import * as schema from './schema';
import type { DbType } from './types';
export const TRASH_FOLDER_ID = 'system-trash';
export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';

/**
 * Seeds system data (folders, settings) on first app launch.
 * This function is idempotent — it only creates data that doesn't exist.
 */
export function seedSystemData(db: DbType): void {
    const now = new Date();

    // Create Trash folder if not exists
    const existingTrash = db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, TRASH_FOLDER_ID))
        .get();

    if (!existingTrash) {
        db.insert(schema.folders).values({
            id: TRASH_FOLDER_ID,
            name: 'Trash',
            icon: 'trash',
            color: '#EF4444', // Red color for trash
            parentId: null,
            isSystem: true,
            isDeleted: false,
            sortType: 'UPDATED_LAST',
            createdAt: now,
            updatedAt: now,
        }).run();
        console.log('Created Trash folder');
    }

    // Create Daily Notes folder if not exists
    const existingDaily = db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, DAILY_NOTES_FOLDER_ID))
        .get();

    if (!existingDaily) {
        db.insert(schema.folders).values({
            id: DAILY_NOTES_FOLDER_ID,
            name: 'Daily Notes',
            icon: 'calendar',
            color: '#8B5CF6', // Amber color for daily notes
            parentId: null,
            isSystem: true,
            isDeleted: false,
            sortType: 'UPDATED_LAST',
            createdAt: now,
            updatedAt: now,
        }).run();
        console.log('Created Daily Notes folder');
    }

    // Initialize default settings if not exist
    const existingTypography = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, 'typography'))
        .get();

    if (!existingTypography) {
        db.insert(schema.settings).values({
            key: 'typography',
            value: JSON.stringify({
                fontFamily: 'System',
                fontSize: 16,
                lineHeight: 1.5,
            }),
        }).run();
        console.log('Created default typography settings');
    }

    // Initialize root sort preference
    const existingRootSort = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, 'rootSortType'))
        .get();

    if (!existingRootSort) {
        db.insert(schema.settings).values({
            key: 'rootSortType',
            value: JSON.stringify('UPDATED_LAST'),
        }).run();
        console.log('Created default root sort setting');
    }

    console.log('System data seeding complete');
}
