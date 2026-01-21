import * as notesRepo from '@/lib/db/repositories/notes.repository';
import type { NoteMetadata } from '@/lib/db/schema';

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
    create: async (folderId: string | null): Promise<NoteMetadata> => {
        return notesRepo.createNoteMetadata(folderId);
    },

    // 2. Update Metadata
    update: async (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>) => {
        notesRepo.updateNoteMetadata(noteId, updates);
    },

    // 3. Update Content
    updateContent: async (noteId: string, content: string) => {
        notesRepo.updateNoteContent(noteId, content);
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
