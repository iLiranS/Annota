import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, DbOrTx, schema } from '../client';
import type { Folder, FolderInsert, NoteMetadata } from '../schema';
import { getDeletedNotes } from './notes.repository';


// Re-export types
export type { Folder } from '../schema';

// System folder IDs
export const TRASH_FOLDER_ID = 'system-trash';
export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';



// ============ FOLDER OPERATIONS ============

export function getFoldersInFolder(parentId: string | null, includeDeleted = false): Folder[] {
    if (parentId === null) {
        if (includeDeleted) {
            return db
                .select()
                .from(schema.folders)
                .where(isNull(schema.folders.parentId))
                .all();
        }
        return db
            .select()
            .from(schema.folders)
            .where(
                and(
                    isNull(schema.folders.parentId),
                    eq(schema.folders.isDeleted, false)
                )
            )
            .all();
    }

    if (includeDeleted) {
        return db
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.parentId, parentId))
            .all();
    }

    return db
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.parentId, parentId),
                eq(schema.folders.isDeleted, false)
            )
        )
        .all();
}

export function getFolderById(folderId: string): Folder | null {
    const result = db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, folderId))
        .get();

    return result ?? null;
}

export function createFolder(folderData: FolderInsert): Folder {
    const folder = db.insert(schema.folders).values(folderData).returning().get();
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

        db
            .update(schema.folders)
            .set({ ...safeUpdates, updatedAt: new Date() })
            .where(eq(schema.folders.id, folderId))
            .run();
        return;
    }

    db
        .update(schema.folders)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.folders.id, folderId))
        .run();
}

// ============ BULK OPERATIONS ============

export function deleteFolders(folderIds: string[], tx: DbOrTx = db): void {
    if (folderIds.length === 0) return;
    tx.delete(schema.folders)
        .where(inArray(schema.folders.id, folderIds))
        .run();
}

export function deleteDeletedFolders(tx: DbOrTx = db): void {
    tx.delete(schema.folders)
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
        ? eq(schema.folders.parentId, folderId)
        : and(
            eq(schema.folders.parentId, folderId),
            eq(schema.folders.isDeleted, false)
        );

    const children = db
        .select()
        .from(schema.folders)
        .where(whereClause)
        .all();

    const childIds = children.map(f => f.id);
    const grandchildIds = childIds.flatMap(id => getAllDescendantFolderIds(id, includeDeleted));

    return [...childIds, ...grandchildIds];
}

export function getTrashContents(): { folders: Folder[], notes: NoteMetadata[] } {
    const folders = db
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
    return db
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
