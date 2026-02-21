import { getDb } from '@/stores/db-store';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DbOrTx, schema } from '../client';
import type { Folder, FolderInsert, NoteMetadata } from '../schema';
import { getDeletedNotes } from './notes.repository';


// Re-export types
export type { Folder } from '../schema';

// System folder IDs
export const TRASH_FOLDER_ID = 'system-trash';
export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';

// ============ SYNC OPERATIONS ============

export function getDirtyFolders(): Folder[] {
    return getDb().select().from(schema.folders).where(eq(schema.folders.isDirty, true)).all();
}

export function clearDirtyFolders(folderIds: string[], syncedAt: Date): void {
    if (folderIds.length === 0) return;
    getDb().update(schema.folders)
        .set({ isDirty: false, lastSyncedAt: syncedAt })
        .where(inArray(schema.folders.id, folderIds))
        .run();
}

export function upsertSyncedFolder(folderData: Folder, tx: DbOrTx = getDb()): void {
    tx.insert(schema.folders)
        .values(folderData)
        .onConflictDoUpdate({ target: schema.folders.id, set: folderData })
        .run();
}



// ============ FOLDER OPERATIONS ============

export function getFoldersInFolder(parentId: string | null, includeDeleted = false): Folder[] {
    if (parentId === null) {
        if (includeDeleted) {
            return getDb()
                .select()
                .from(schema.folders)
                .where(isNull(schema.folders.parentId))
                .all();
        }
        return getDb()
            .select()
            .from(schema.folders)
            .where(
                and(
                    isNull(schema.folders.parentId),
                    eq(schema.folders.isDeleted, false),
                    eq(schema.folders.isPermDeleted, false)
                )
            )
            .all();
    }

    if (includeDeleted) {
        return getDb()
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.parentId, parentId))
            .all();
    }

    return getDb()
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.parentId, parentId),
                eq(schema.folders.isDeleted, false),
                eq(schema.folders.isPermDeleted, false)
            )
        )
        .all();
}

export function getFolderById(folderId: string): Folder | null {
    const result = getDb()
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, folderId))
        .get();

    return result ?? null;
}

export function createFolder(folderData: FolderInsert): Folder {
    const folder = getDb().insert(schema.folders).values(folderData).returning().get();
    if (!folder) {
        throw new Error('Failed to create folder');
    }
    return folder;
}

export function updateFolder(
    folderId: string,
    updates: Partial<Omit<Folder, 'id' | 'createdAt'>>
): void {
    const folder = getFolderById(folderId);

    // Prevent updating system folders' name or critical properties
    if (folder?.isSystem) {
        const safeUpdates = { ...updates };
        delete safeUpdates.name;
        delete safeUpdates.isSystem;

        getDb()
            .update(schema.folders)
            .set({ ...safeUpdates, updatedAt: new Date() })
            .where(eq(schema.folders.id, folderId))
            .run();
        return;
    }

    getDb()
        .update(schema.folders)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.folders.id, folderId))
        .run();
}

// ============ BULK OPERATIONS ============

export function deleteFolders(folderIds: string[], tx: DbOrTx = getDb()): void {
    if (folderIds.length === 0) return;
    tx.update(schema.folders)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(inArray(schema.folders.id, folderIds))
        .run();
}

export function deleteDeletedFolders(tx: DbOrTx = getDb()): void {
    tx.update(schema.folders)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .run();
}


// Get all descendant folder IDs (recursive)
export function getAllDescendantFolderIds(folderId: string, includeDeleted = false): string[] {
    const whereClause = includeDeleted
        ? and(eq(schema.folders.parentId, folderId), eq(schema.folders.isPermDeleted, false))
        : and(
            eq(schema.folders.parentId, folderId),
            eq(schema.folders.isDeleted, false),
            eq(schema.folders.isPermDeleted, false)
        );

    const children = getDb()
        .select()
        .from(schema.folders)
        .where(whereClause)
        .all();

    const childIds = children.map(f => f.id);
    const grandchildIds = childIds.flatMap(id => getAllDescendantFolderIds(id, includeDeleted));

    return [...childIds, ...grandchildIds];
}

export function getTrashContents(): { folders: Folder[], notes: NoteMetadata[] } {
    const folders = getDb()
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .all();

    const notes = getDeletedNotes();

    return { folders, notes };
}

export function getDeletedFolders(): Folder[] {
    return getDb()
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .all();
}
