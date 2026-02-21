import { schema } from '@/lib/db/client';
import * as foldersRepo from '@/lib/db/repositories/folders.repository';
import * as notesRepo from '@/lib/db/repositories/notes.repository';
import type { Folder, FolderInsert } from '@/lib/db/schema';
import { getDb } from '@/stores/db-store';
import { eq, inArray, sql } from 'drizzle-orm';
import { generateFolder } from '../utils/folders';
import { NoteImageService } from './images';

// Re-export constants
export { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID } from '@/lib/db/repositories/folders.repository';

export const FolderService = {
    // ... EXISTING METHODS ...

    // 0. Getters (Read)
    getFoldersInFolder: (parentId: string | null, includeDeleted: boolean = false) => {
        return foldersRepo.getFoldersInFolder(parentId, includeDeleted);
    },

    getFolderById: (folderId: string) => {
        return foldersRepo.getFolderById(folderId);
    },

    // 1. Create

    create: async (folderData: Partial<FolderInsert>): Promise<Folder> => {
        const folder = generateFolder(folderData);
        return foldersRepo.createFolder(folder);
    },

    // 2. Update
    update: async (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => {
        foldersRepo.updateFolder(folderId, { ...updates, isDirty: true });
    },

    // 3. Soft Delete (Cascading - with Transaction)
    softDelete: async (folderId: string): Promise<string[]> => {
        const folder = foldersRepo.getFolderById(folderId);

        if (!folder || folder.isSystem) {
            throw new Error('Cannot delete system folder');
        }

        const now = new Date();

        // Get all descendant IDs recursively
        const allDescendantIds = foldersRepo.getAllDescendantFolderIds(folderId);
        const allIdsToProcess = [folderId, ...allDescendantIds];

        // Use transaction with efficient bulk queries
        await getDb().transaction(async (tx) => {
            // 1. Update ROOT folder: Move to trash, mark deleted, save original parent
            tx.update(schema.folders)
                .set({
                    isDeleted: true,
                    deletedAt: now,
                    originalParentId: folder.parentId,
                    parentId: foldersRepo.TRASH_FOLDER_ID,
                    updatedAt: now,
                })
                .where(eq(schema.folders.id, folderId))
                .run();

            // 2. Update DESCENDANT folders (if any): Mark deleted, save original parent, keep structure
            if (allDescendantIds.length > 0) {
                tx.update(schema.folders)
                    .set({
                        isDeleted: true,
                        deletedAt: now,
                        originalParentId: sql`parent_id`, // Snapshot parentId
                        updatedAt: now
                    })
                    .where(inArray(schema.folders.id, allDescendantIds))
                    .run();
            }

            // 3. Update NOTES in all affected folders
            notesRepo.softDeleteNotesInFolders(allIdsToProcess, now, tx);
        });

        return allIdsToProcess;
    },

    // 4. Restore
    restore: async (folderId: string): Promise<{ folderIds: string[], noteIds: string[], restoredParentId: string | null }> => {
        const folder = foldersRepo.getFolderById(folderId);
        if (!folder) return { folderIds: [], noteIds: [], restoredParentId: null };

        const now = new Date();
        // 1. Get ALL descendants (including deleted ones!)
        const allDescendantIds = foldersRepo.getAllDescendantFolderIds(folderId, true);
        const allFolderIds = [folderId, ...allDescendantIds];

        // 2. Identify affected notes BEFORE update (so we know what to restore in store)
        const affectedNoteIds = notesRepo.getNoteIdsByOriginalFolderIds(allFolderIds, folder.deletedAt || now);

        // Determine restore location of the restored folder
        let restoredParentId: string | null = null;
        if (folder.originalParentId) {
            const originalParent = foldersRepo.getFolderById(folder.originalParentId);
            if (originalParent && !originalParent.isDeleted) {
                restoredParentId = folder.originalParentId;
            }
        }

        await getDb().transaction(async (tx) => {
            // 1. Restore ROOT folder
            tx.update(schema.folders)
                .set({
                    isDeleted: false,
                    deletedAt: null,
                    parentId: restoredParentId,
                    originalParentId: null,
                })
                .where(eq(schema.folders.id, folderId))
                .run();

            // 2. Restore DESCENDANT folders
            if (allDescendantIds.length > 0) {
                tx.update(schema.folders)
                    .set({
                        isDeleted: false,
                        deletedAt: null,
                        originalParentId: null,
                    })
                    .where(inArray(schema.folders.id, allDescendantIds))
                    .run();
            }

            // 3. Restore NOTES
            notesRepo.restoreNotesInFolders(allFolderIds, folder.deletedAt || now, tx);
        });

        return { folderIds: allFolderIds, noteIds: affectedNoteIds, restoredParentId };
    },

    // 5. Permanent Delete
    permanentlyDelete: async (folderId: string) => {
        const folder = foldersRepo.getFolderById(folderId);
        if (!folder || folder.isSystem) return;

        const allDescendantIds = foldersRepo.getAllDescendantFolderIds(folderId);
        const allFolderIds = [folderId, ...allDescendantIds];

        await getDb().transaction(async (tx) => {
            // 1. Delete Notes
            notesRepo.permanentlyDeleteNotesInFolders(allFolderIds, tx);

            // 2. Delete Folders
            foldersRepo.deleteFolders(allFolderIds, tx);
        });
    },

    // 6. Empty Trash
    emptyTrash: async () => {
        try {
            // 1. Clean up images for all deleted notes
            const deletedNoteIds = notesRepo.getDeletedNoteIds();
            for (const noteId of deletedNoteIds) {
                NoteImageService.cleanupImagesForNote(noteId);
            }

            // 2. Delete notes and folders
            await getDb().transaction(async (tx) => {
                notesRepo.permanentlyDeleteDeletedNotes(tx);
                foldersRepo.deleteDeletedFolders(tx);
            });
        } catch (err) {
            console.error('Failed to empty trash:', err);
            return false
        }
        return true
    }
};


