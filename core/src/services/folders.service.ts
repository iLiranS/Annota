import { eq, inArray, sql } from 'drizzle-orm';
import { getDb, purgeGuestTombstones } from '../db';
import * as foldersRepo from '../db/repositories/folders.repository';
import * as notesRepo from '../db/repositories/notes.repository';
import type { Folder, FolderInsert } from '../db/schema';
import * as schema from '../db/schema';
import { generateFolder } from '../utils/folders';
import { NoteImageService } from './images';

// Re-export constants
export { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID } from '../db/repositories/folders.repository';

export const FolderService = {
    // ... EXISTING METHODS ...

    getFoldersInFolder: async (parentId: string | null, includeDeleted: boolean = false) => {
        return await foldersRepo.getFoldersInFolder(parentId, includeDeleted);
    },

    getFolderById: async (folderId: string) => {
        return await foldersRepo.getFolderById(folderId);
    },

    // 1. Create

    create: async (folderData: Partial<FolderInsert>): Promise<Folder> => {
        const folder = generateFolder(folderData);
        return await foldersRepo.createFolder(folder);
    },

    // 2. Update
    update: async (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => {
        await foldersRepo.updateFolder(folderId, { ...updates, isDirty: true });
    },

    // 3. Soft Delete (Cascading - with Transaction)
    softDelete: async (folderId: string): Promise<string[]> => {
        const folder = await foldersRepo.getFolderById(folderId);

        if (!folder || folder.isSystem) {
            throw new Error('Cannot delete system folder');
        }

        const now = new Date();

        // Get all descendant IDs recursively
        const allDescendantIds = await foldersRepo.getAllDescendantFolderIds(folderId);
        const allIdsToProcess = [folderId, ...allDescendantIds];

        await getDb().transaction(async (tx: any) => {
            await tx.update(schema.folders)
                .set({
                    isDeleted: true,
                    isDirty: true,
                    deletedAt: now,
                    originalParentId: folder.parentId ?? null,
                    parentId: foldersRepo.TRASH_FOLDER_ID,
                    updatedAt: now
                })
                .where(eq(schema.folders.id, folderId))
                .run();

            if (allDescendantIds.length > 0) {
                await tx.update(schema.folders)
                    .set({
                        isDeleted: true,
                        isDirty: true,
                        deletedAt: now,
                        originalParentId: sql`${schema.folders.parentId}`,
                        updatedAt: now
                    })
                    .where(inArray(schema.folders.id, allDescendantIds))
                    .run();
            }

            await notesRepo.softDeleteNotesInFolders(allIdsToProcess, now, tx);
        });

        return allIdsToProcess;
    },

    // 4. Restore
    restore: async (folderId: string): Promise<{ folderIds: string[], noteIds: string[], restoredParentId: string | null }> => {
        const folder = await foldersRepo.getFolderById(folderId);
        if (!folder) return { folderIds: [], noteIds: [], restoredParentId: null };

        const now = new Date();
        // 1. Get ALL descendants (including deleted ones!)
        const allDescendantIds = await foldersRepo.getAllDescendantFolderIds(folderId, true);
        const allFolderIds = [folderId, ...allDescendantIds];

        // 2. Identify affected notes BEFORE update (so we know what to restore in store)
        const affectedNoteIds = await notesRepo.getNoteIdsByOriginalFolderIds(allFolderIds, folder.deletedAt || now);

        // Determine restore location of the restored folder
        let restoredParentId: string | null = null;
        if (folder.originalParentId) {
            const originalParent = await foldersRepo.getFolderById(folder.originalParentId);
            if (originalParent && !originalParent.isDeleted) {
                restoredParentId = folder.originalParentId;
            }
        }

        await getDb().transaction(async (tx: any) => {
            await tx.update(schema.folders)
                .set({
                    isDeleted: false,
                    isDirty: true,
                    updatedAt: now,
                    deletedAt: null,
                    parentId: restoredParentId,
                    originalParentId: null
                })
                .where(eq(schema.folders.id, folderId))
                .run();

            if (allDescendantIds.length > 0) {
                await tx.update(schema.folders)
                    .set({
                        isDeleted: false,
                        isDirty: true,
                        updatedAt: now,
                        deletedAt: null,
                        originalParentId: null
                    })
                    .where(inArray(schema.folders.id, allDescendantIds))
                    .run();
            }

            await notesRepo.restoreNotesInFolders(allFolderIds, folder.deletedAt || now, tx);
        });

        return { folderIds: allFolderIds, noteIds: affectedNoteIds, restoredParentId };
    },

    // 5. Permanent Delete
    permanentlyDelete: async (folderId: string) => {
        const folder = await foldersRepo.getFolderById(folderId);
        if (!folder || folder.isSystem) return;

        const allDescendantIds = await foldersRepo.getAllDescendantFolderIds(folderId);
        const allFolderIds = [folderId, ...allDescendantIds];

        await getDb().transaction(async (tx: any) => {
            await notesRepo.permanentlyDeleteNotesInFolders(allFolderIds, tx);
            await foldersRepo.deleteFolders(allFolderIds, tx);
        });
    },

    // 6. Empty Trash
    emptyTrash: async () => {
        try {
            // 1. Clean up images for all deleted notes
            const deletedNoteIds = await notesRepo.getDeletedNoteIds();
            for (const noteId of deletedNoteIds) {
                await NoteImageService.cleanupImagesForNote(noteId);
            }

            // 2. Delete notes and folders
            await getDb().transaction(async (tx: any) => {
                await notesRepo.permanentlyDeleteDeletedNotes(tx);
                await foldersRepo.deleteDeletedFolders(tx);
            });

            // For guest users, physically delete the tombstones right away
            await purgeGuestTombstones();
        } catch (err) {
            console.error('Failed to empty trash:', err);
            return false;
        }
        return true;
    }
};
