import * as notesRepo from '@/lib/db/repositories/notes.repository';
import type { NoteMetadata } from '@/lib/db/schema';
import { insertNoteMetadataSchema } from '../db/validators/notes';
import { generateNoteMetadata, generatePreview, generateTitle } from '../utils/notes';

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
        const title = generateTitle(updates.title ?? '');
        try {
            insertNoteMetadataSchema.pick({ title: true }).parse({ title });
            const noteMetadata = notesRepo.updateNoteMetadata(noteId, { ...updates, title, isDirty: true });
            return noteMetadata
        } catch (err) {
            console.error(err)
            return null
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
        notesRepo.permanentlyDeleteNote(noteId);
    }
};
