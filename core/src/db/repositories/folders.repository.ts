import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import type { Folder, FolderInsert, NoteMetadata } from '../schema';
import * as schema from '../schema';
import type { DbOrTx } from '../types';
import { safeGet, safeGetAll } from '../utils';
import { getDeletedNotes } from './notes.repository';


// Re-export types
export type { Folder } from '../schema';

// System folder IDs
export const TRASH_FOLDER_ID = 'system-trash';
export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';

// ============ SYNC OPERATIONS ============

export async function getDirtyFolders(): Promise<Folder[]> {
    const result = await getDb().select().from(schema.folders).where(eq(schema.folders.isDirty, true)).all();
    return safeGetAll<Folder>(result);
}

export async function clearDirtyFolders(folderIds: string[]): Promise<void> {
    if (folderIds.length === 0) return;
    await getDb().update(schema.folders)
        .set({ isDirty: false })
        .where(inArray(schema.folders.id, folderIds))
        .run();
}

export async function upsertSyncedFolder(folderData: Folder, tx: DbOrTx = getDb()): Promise<void> {
    const result = await tx.select().from(schema.folders).where(eq(schema.folders.id, folderData.id)).get();
    const existing = safeGet<Folder>(result);
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
            const result = await getDb()
                .select()
                .from(schema.folders)
                .where(isNull(schema.folders.parentId))
                .all();
            return safeGetAll<Folder>(result);
        }
        const result2 = await getDb()
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
        return safeGetAll<Folder>(result2);
    }

    if (includeDeleted) {
        const result3 = await getDb()
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.parentId, parentId))
            .all();
        return safeGetAll<Folder>(result3);
    }

    const result4 = await getDb()
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
    return safeGetAll<Folder>(result4);
}

export async function getFolderById(folderId: string): Promise<Folder | null> {
    const result = await getDb()
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, folderId))
        .get();

    return safeGet<Folder>(result);
}

export async function createFolder(folderData: FolderInsert): Promise<Folder> {
    const folderRes = await getDb().insert(schema.folders).values(folderData).returning().get();
    const folder = safeGet<Folder>(folderRes);
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

    const safeChildren = safeGetAll<Folder>(children);

    const childIds = safeChildren.map(f => f.id);
    const grandchildIdsNested = await Promise.all(
        childIds.map((id: string) => getAllDescendantFolderIds(id, includeDeleted))
    );
    const grandchildIds = grandchildIdsNested.flat();

    return [...childIds, ...grandchildIds];
}

export async function getTrashContents(): Promise<{ folders: Folder[], notes: NoteMetadata[] }> {
    const foldersRes = await getDb()
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .all();

    const folders = safeGetAll<Folder>(foldersRes);

    const notes = await getDeletedNotes();

    return { folders, notes };
}

export async function getDeletedFolders(): Promise<Folder[]> {
    const result = await getDb()
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .all();
    return safeGetAll<Folder>(result);
}

export async function getFoldersCount(tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx.select({ count: sql<number>`count(*)` })
        .from(schema.folders)
        .where(and(eq(schema.folders.isPermDeleted, false), eq(schema.folders.isSystem, false)))
        .get();
    const safeResult = safeGet<{ count: number }>(result);
    return safeResult?.count ?? 0;
}
