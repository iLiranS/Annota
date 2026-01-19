import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../client';
import type { Folder, FolderInsert, NoteMetadata } from '../schema';
import { getDeletedNotes } from './notes.repository';

// Re-export types
export type { Folder } from '../schema';

// System folder IDs
export const TRASH_FOLDER_ID = 'system-trash';
export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';

// Helper to generate unique IDs
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

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

export function createFolder(
    parentId: string | null,
    name: string,
    icon: string = 'folder'
): Folder {
    const now = new Date();
    const id = generateId();

    const folderData: FolderInsert = {
        id,
        parentId,
        name,
        icon,
        sortType: 'UPDATED_LAST',
        isSystem: false,
        isDeleted: false,
        deletedAt: null,
        originalParentId: null,
        createdAt: now,
        updatedAt: now,
    };

    db.insert(schema.folders).values(folderData).run();

    return db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, id))
        .get()!;
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

// Get all descendant folder IDs (recursive)
function getAllDescendantFolderIds(folderId: string): string[] {
    const children = db
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.parentId, folderId),
                eq(schema.folders.isDeleted, false)
            )
        )
        .all();

    const childIds = children.map(f => f.id);
    const grandchildIds = childIds.flatMap(id => getAllDescendantFolderIds(id));

    return [...childIds, ...grandchildIds];
}

export function softDeleteFolder(folderId: string): void {
    const folder = getFolderById(folderId);

    // Prevent deleting system folders
    if (!folder || folder.isSystem) return;

    const now = new Date();
    const allFolderIds = [folderId, ...getAllDescendantFolderIds(folderId)];

    // Soft delete all descendant folders
    for (const id of allFolderIds) {
        const f = getFolderById(id);
        if (!f) continue;

        db
            .update(schema.folders)
            .set({
                isDeleted: true,
                deletedAt: now,
                originalParentId: f.parentId,
                // Only top folder moves to trash, children keep their parent
                parentId: id === folderId ? TRASH_FOLDER_ID : f.parentId,
                updatedAt: now,
            })
            .where(eq(schema.folders.id, id))
            .run();
    }

    // Soft delete all notes in these folders
    for (const id of allFolderIds) {
        const notes = db
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.folderId, id))
            .all();

        for (const note of notes) {
            db
                .update(schema.noteMetadata)
                .set({
                    isDeleted: true,
                    deletedAt: now,
                    originalFolderId: note.folderId,
                    updatedAt: now,
                })
                .where(eq(schema.noteMetadata.id, note.id))
                .run();
        }
    }
}

export function restoreFolder(folderId: string, targetParentId?: string | null): void {
    const folder = getFolderById(folderId);
    if (!folder) return;

    const now = new Date();
    const allFolderIds = [folderId, ...getAllDescendantFolderIds(folderId)];

    // Determine restore location for top folder
    let restoredParentId: string | null = null;
    if (targetParentId !== undefined) {
        restoredParentId = targetParentId;
    } else if (folder.originalParentId) {
        const originalParent = getFolderById(folder.originalParentId);
        if (originalParent && !originalParent.isDeleted) {
            restoredParentId = folder.originalParentId;
        }
    }

    // Restore all folders
    for (const id of allFolderIds) {
        const f = getFolderById(id);
        if (!f) continue;

        const newParentId = id === folderId
            ? restoredParentId
            : (f.originalParentId ?? f.parentId);

        db
            .update(schema.folders)
            .set({
                isDeleted: false,
                deletedAt: null,
                parentId: newParentId,
                originalParentId: null,
                updatedAt: now,
            })
            .where(eq(schema.folders.id, id))
            .run();
    }

    // Restore notes in these folders
    for (const id of allFolderIds) {
        const notes = db
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.originalFolderId, id))
            .all();

        for (const note of notes) {
            db
                .update(schema.noteMetadata)
                .set({
                    isDeleted: false,
                    deletedAt: null,
                    folderId: note.originalFolderId,
                    originalFolderId: null,
                    updatedAt: now,
                })
                .where(eq(schema.noteMetadata.id, note.id))
                .run();
        }
    }
}

export function permanentlyDeleteFolder(folderId: string): void {
    const folder = getFolderById(folderId);

    // Prevent permanently deleting system folders
    if (!folder || folder.isSystem) return;

    const allFolderIds = [folderId, ...getAllDescendantFolderIds(folderId)];

    // Delete all notes in these folders (including content and versions)
    for (const id of allFolderIds) {
        const notes = db
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.folderId, id))
            .all();

        for (const note of notes) {
            db.delete(schema.noteContent).where(eq(schema.noteContent.noteId, note.id)).run();
            db.delete(schema.noteVersions).where(eq(schema.noteVersions.noteId, note.id)).run();
            db.delete(schema.noteMetadata).where(eq(schema.noteMetadata.id, note.id)).run();
        }
    }

    // Delete all folders (in reverse order to handle children first)
    for (const id of allFolderIds.reverse()) {
        db.delete(schema.folders).where(eq(schema.folders.id, id)).run();
    }
}

export function emptyTrash(): void {
    // Get all deleted notes
    const deletedNotes = getDeletedNotes();

    // Permanently delete all deleted notes
    for (const note of deletedNotes) {
        db.delete(schema.noteContent).where(eq(schema.noteContent.noteId, note.id)).run();
        db.delete(schema.noteVersions).where(eq(schema.noteVersions.noteId, note.id)).run();
        db.delete(schema.noteMetadata).where(eq(schema.noteMetadata.id, note.id)).run();
    }

    // Get all deleted folders (non-system)
    const deletedFolders = db
        .select()
        .from(schema.folders)
        .where(
            and(
                eq(schema.folders.isDeleted, true),
                eq(schema.folders.isSystem, false)
            )
        )
        .all();

    // Permanently delete all deleted folders
    for (const folder of deletedFolders) {
        db.delete(schema.folders).where(eq(schema.folders.id, folder.id)).run();
    }
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
