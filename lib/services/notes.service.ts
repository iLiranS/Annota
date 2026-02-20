import * as ImagesRepo from '@/lib/db/repositories/images.repository';
import * as notesRepo from '@/lib/db/repositories/notes.repository';
import type { NoteMetadata } from '@/lib/db/schema';
import { insertNoteMetadataSchema } from '../db/validators/notes';
import { generateNoteMetadata, generatePreview, generateTitle } from '../utils/notes';
import * as NoteImageService from './images/note-image.service';

export const NoteService = {
    // 0. Getters
    getNotesInFolder: (folderId: string | null, includeDeleted: boolean = false): NoteMetadata[] => {
        return notesRepo.getNotesInFolder(folderId, includeDeleted);
    },

    getNoteById: (noteId: string): NoteMetadata | null => {
        return notesRepo.getNoteMetadataById(noteId);
    },

    getNoteContent: (noteId: string): string => {
        return notesRepo.getNoteContent(noteId);
    },

    // 1. Create
    create: async (data: Partial<NoteMetadata>): Promise<NoteMetadata> => {
        const metadata = generateNoteMetadata(data);
        return notesRepo.createNoteMetadata(metadata);
    },

    // 2. Update Metadata
    updateMetadata: async (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>): Promise<NoteMetadata | null> => {
        try {
            // Validate updates using the partial schema (allows updating single fields)
            const validatedUpdates = insertNoteMetadataSchema.partial().parse(updates);

            // If title is being updated, regenerate it to ensure it's valid (e.g. trimming)
            // validating schema touches title but we might want to ensure consistent generation logic if needed,
            // though schema validation handles min/max length.
            // The previous logic called generateTitle, let's keep it if it does specific formatting.
            if (validatedUpdates.title) {
                validatedUpdates.title = generateTitle(validatedUpdates.title);
            }

            // console.log(`[NoteService] Updating note ${noteId} with:`, validatedUpdates);

            return notesRepo.updateNoteMetadata(noteId, { ...validatedUpdates, isDirty: true });
        } catch (err) {
            console.error('[NoteService] Update validation failed:', err);
            return null;
        }
    },

    // 3. Update Content
    updateContent: async (noteId: string, content: string) => {
        const preview = generatePreview(content);
        notesRepo.updateNoteContent(noteId, content, preview);
    },

    // 4. Soft Delete
    softDelete: async (noteId: string) => {
        notesRepo.softDeleteNote(noteId);
    },

    // 5. Restore
    restore: async (noteId: string, targetFolderId?: string | null) => {
        notesRepo.restoreNote(noteId, targetFolderId);
    },

    // 6. Permanent Delete
    permanentlyDelete: async (noteId: string) => {
        // 1. Clean up images (moved from repo)
        NoteImageService.cleanupImagesForNote(noteId);

        // 2. Delete Note
        notesRepo.permanentlyDeleteNote(noteId);
    },

    // 7. Versions
    getVersions: async (noteId: string) => {
        return notesRepo.getNoteVersions(noteId);
    },

    getVersion: async (versionId: string) => {
        return notesRepo.getNoteVersion(versionId);
    },

    deleteVersion: async (noteId: string, versionId: string) => {
        // 1. Get images used in this version (before they are unlinked by deletion)
        const imageIds = NoteImageService.getImageIdsForVersion(versionId);

        // 2. Delete the links in version_images table (Critical Step for Orphans check)
        // We must remove the links SO THAT cleanupOrphans sees the count decrease.
        ImagesRepo.deleteImagesForVersions([versionId]);

        // 3. Delete the version record
        notesRepo.deleteNoteVersion(versionId);

        // 4. Cleanup images that might have become orphans
        NoteImageService.cleanupOrphans(imageIds);
    }
};
