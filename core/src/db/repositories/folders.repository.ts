import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import type { Folder, FolderInsert, NoteMetadata } from '../schema';
import * as schema from '../schema';
import type { DbOrTx } from '../types';
import { getDeletedNotes } from './notes.repository';


// Re-export types
export type { Folder } from '../schema';

// System folder IDs
export const TRASH_FOLDER_ID = 'system-trash';
export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';

// ============ SYNC OPERATIONS ============

export async function getDirtyFolders(): Promise<Folder[]> {
    return await getDb().select().from(schema.folders).where(eq(schema.folders.isDirty, true)).all();
}

export async function clearDirtyFolders(folderIds: string[]): Promise<void> {
    if (folderIds.length === 0) return;
    await getDb().update(schema.folders)
        .set({ isDirty: false })
        .where(inArray(schema.folders.id, folderIds))
        .run();
}

export async function upsertSyncedFolder(folderData: Folder, tx: DbOrTx = getDb()): Promise<void> {
    const existing = await tx.select().from(schema.folders).where(eq(schema.folders.id, folderData.id)).get();
    if (existing && existing.updatedAt > folderData.updatedAt) {
        console.log(`[Sync] Local folder ${folderData.id} is newer, ignoring pulled row. Local: ${existing.updatedAt}, Pulled: ${folderData.updatedAt}`);
        return;
    }

    await tx.insert(schema.folders)
        .values(folderData)
        .onConflictDoUpdate({ target: schema.folders.id, set: folderData })
        .run();
}


// ============ FOLDER OPERATIONS ============

export async function getFoldersInFolder(parentId: string | null, includeDeleted = false): Promise<Folder[]> {
    if (parentId === null) {
        if (includeDeleted) {
            return await getDb()
                .select()
                .from(schema.folders)
                .where(isNull(schema.folders.parentId))
                .all();
        }
        return await getDb()
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
        return await getDb()
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.parentId, parentId))
            .all();
    }

    return await getDb()
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

export async function getFolderById(folderId: string): Promise<Folder | null> {
    const result = await getDb()
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, folderId))
        .get();

    return result ?? null;
}

export async function createFolder(folderData: FolderInsert): Promise<Folder> {
    const folder = await getDb().insert(schema.folders).values(folderData).returning().get();
    if (!folder) {
        throw new Error('Failed to create folder');
    }
    return folder;
}

export async function updateFolder(
    folderId: string,
    updates: Partial<Omit<Folder, 'id' | 'createdAt'>>
): Promise<void> {
    const folder = await getFolderById(folderId);

    // Prevent updating system folders' name or critical properties
    if (folder?.isSystem) {
        const safeUpdates = { ...updates };
        delete safeUpdates.name;
        delete safeUpdates.isSystem;

        await getDb()
            .update(schema.folders)
            .set({ ...safeUpdates, updatedAt: new Date() })
            .where(eq(schema.folders.id, folderId))
            .run();
        return;
    }

    await getDb()
        .update(schema.folders)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.folders.id, folderId))
        .run();
}

// ============ BULK OPERATIONS ============

export async function deleteFolders(folderIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (folderIds.length === 0) return;
    await tx.update(schema.folders)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(inArray(schema.folders.id, folderIds))
        .run();
}

export async function deleteDeletedFolders(tx: DbOrTx = getDb()): Promise<void> {
    await tx.update(schema.folders)
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
export async function getAllDescendantFolderIds(folderId: string, includeDeleted = false): Promise<string[]> {
    const whereClause = includeDeleted
        ? and(eq(schema.folders.parentId, folderId), eq(schema.folders.isPermDeleted, false))
        : and(
            eq(schema.folders.parentId, folderId),
            eq(schema.folders.isDeleted, false),
            eq(schema.folders.isPermDeleted, false)
        );

    const children = await getDb()
        .select()
        .from(schema.folders)
        .where(whereClause)
        .all();

    const childIds = children.map((f: Folder) => f.id);
    const grandchildIds = childIds.flatMap((id: string) => getAllDescendantFolderIds(id, includeDeleted));

    return [...childIds, ...grandchildIds];
}

export async function getTrashContents(): Promise<{ folders: Folder[], notes: NoteMetadata[] }> {
    const folders = await getDb()
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .all();

    const notes = await getDeletedNotes();

    return { folders, notes };
}

export async function getDeletedFolders(): Promise<Folder[]> {
    return await getDb()
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

export async function getFoldersCount(tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx.select({ count: sql<number>`count(*)` })
        .from(schema.folders)
        .where(and(eq(schema.folders.isDeleted, false), eq(schema.folders.isPermDeleted, false), eq(schema.folders.isSystem, false)))
        .get();
    return result?.count ?? 0;
}
