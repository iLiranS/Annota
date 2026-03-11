import * as ImagesRepo from '../db/repositories/images.repository';
import * as notesRepo from '../db/repositories/notes.repository';
import type { NoteMetadata } from '../db/schema';
import { insertNoteMetadataSchema } from '../db/validators/notes';
import { generateNoteMetadata, generatePreview, generateTitle } from '../utils/notes';
import * as NoteImageService from './images/note-image.service';
import { TagService } from './tags.service';

export const NoteService = {
    // 0. Getters
    getNotesInFolder: async (folderId: string | null, includeDeleted: boolean = false): Promise<NoteMetadata[]> => {
        return await notesRepo.getNotesInFolder(folderId, includeDeleted);
    },

    getNoteById: async (noteId: string): Promise<NoteMetadata | null> => {
        return await notesRepo.getNoteMetadataById(noteId);
    },

    getNoteContent: async (noteId: string): Promise<string> => {
        return await notesRepo.getNoteContent(noteId);
    },

    // 1. Create
    create: async (data: Partial<NoteMetadata>): Promise<NoteMetadata> => {
        const metadata = generateNoteMetadata(data);
        return await notesRepo.createNoteMetadata(metadata);
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
                const existing = await notesRepo.getNoteMetadataById(noteId);
                if (existing?.folderId === 'system-daily-notes') {
                    delete (validatedUpdates as any).title;
                } else {
                    (validatedUpdates as any).title = generateTitle(validatedUpdates.title);
                }
            }

            // If only title was provided and it was a daily note, we might have no updates left
            if (Object.keys(validatedUpdates).length === 0) {
                return await notesRepo.getNoteMetadataById(noteId);
            }

            // console.log(`[NoteService] Updating note ${noteId} with:`, validatedUpdates);

            return await notesRepo.updateNoteMetadata(noteId, { ...validatedUpdates, isDirty: true });
        } catch (err) {
            console.error('[NoteService] Update validation failed:', err);
            return null;
        }
    },

    // 3. Update Content
    updateContent: async (noteId: string, content: string) => {
        const metadata = await notesRepo.getNoteMetadataById(noteId);
        const isDailyNote = metadata?.folderId === 'system-daily-notes';

        const preview = isDailyNote ? generateTitle(content) : generatePreview(content);
        await notesRepo.updateNoteContent(noteId, content, preview);
    },

    // 4. Soft Delete
    softDelete: async (noteId: string) => {
        await notesRepo.softDeleteNote(noteId);
    },

    // 5. Restore
    restore: async (noteId: string, targetFolderId?: string | null) => {
        await notesRepo.restoreNote(noteId, targetFolderId);
    },

    // 6. Permanent Delete
    permanentlyDelete: async (noteId: string) => {
        // 1. Clean up images (moved from repo)
        await NoteImageService.cleanupImagesForNote(noteId);

        // 2. Delete Note
        await notesRepo.permanentlyDeleteNote(noteId);
    },

    // 7. Versions
    getVersions: async (noteId: string) => {
        return await notesRepo.getNoteVersions(noteId);
    },

    getVersion: async (versionId: string) => {
        return await notesRepo.getNoteVersion(versionId);
    },

    deleteVersion: async (_noteId: string, versionId: string) => {
        // 1. Get images used in this version (before they are unlinked by deletion)
        const imageIds = await NoteImageService.getImageIdsForVersion(versionId);

        // 2. Delete the links in version_images table (Critical Step for Orphans check)
        // We must remove the links SO THAT cleanupOrphans sees the count decrease.
        await ImagesRepo.deleteImagesForVersions([versionId]);

        // 3. Delete the version record
        await notesRepo.deleteNoteVersion(versionId);

        // 4. Cleanup images that might have become orphans
        await NoteImageService.cleanupOrphans(imageIds);
    },

    deleteAllVersionsExceptLatest: async (noteId: string) => {
        await notesRepo.deleteAllNoteVersionsExceptLatest(noteId);
    },

    // 8. Tags
    addTag: async (noteId: string, tag: { id?: string, name: string, color: string }) => {
        const metadata = await notesRepo.getNoteMetadataById(noteId);
        if (!metadata) return null;

        const normalizedName = tag.name.trim();
        if (!normalizedName) return null;

        let existingTag = tag.id ? await TagService.getTagById(tag.id) : null;

        // Ensure existingTag is an actual object with an id, not an empty array
        if (!existingTag?.id) {
            existingTag = await TagService.getTagByName(normalizedName);
        }

        // Again, explicitly check for the id
        if (!existingTag?.id) {
            existingTag = await TagService.create({
                ...tag,
                name: normalizedName,
                // Make sure to use Date.now() if Tauri is still complaining about Date objects!
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        const tagId = existingTag.id;
        if (!tagId) return null; // Ultimate safety check

        let tagsArray: string[] = [];
        try {
            tagsArray = JSON.parse(metadata.tags);
            if (!Array.isArray(tagsArray)) tagsArray = [];
        } catch {
            tagsArray = [];
        }

        if (!tagsArray.includes(tagId)) {
            tagsArray.push(tagId);
            const updatedNote = await notesRepo.updateNoteMetadata(noteId, {
                tags: JSON.stringify(tagsArray),
                isDirty: true
            });
            return updatedNote ? { note: updatedNote, tag: existingTag } : null;
        }

        return { note: metadata, tag: existingTag };
    },

    removeTag: async (noteId: string, tagId: string) => {
        const metadata = await notesRepo.getNoteMetadataById(noteId);
        if (!metadata) return null;

        let tagsArray: string[] = [];
        try {
            tagsArray = JSON.parse(metadata.tags);
        } catch {
            tagsArray = [];
        }

        if (tagsArray.includes(tagId)) {
            tagsArray = tagsArray.filter(id => id !== tagId);
            return await notesRepo.updateNoteMetadata(noteId, { tags: JSON.stringify(tagsArray), isDirty: true });
        }
        return metadata;
    }
};
