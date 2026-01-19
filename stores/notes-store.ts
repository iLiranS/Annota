import { SortType, sortFolders, sortNotes } from '@/dev-data/data';
import type { Folder } from '@/lib/db/repositories/folders.repository';
import * as foldersRepo from '@/lib/db/repositories/folders.repository';
import type { NoteMetadata } from '@/lib/db/repositories/notes.repository';
import * as notesRepo from '@/lib/db/repositories/notes.repository';
import { create } from 'zustand';

// Re-export types for convenience
export { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID } from '@/lib/db/repositories/folders.repository';
export type { Folder, NoteMetadata };

// Root folder sorting preference (stored separately since root has no folder entity)
interface RootSettings {
    sortType: SortType;
}

interface NotesState {
    // Data (cached from DB)
    notes: NoteMetadata[];
    folders: Folder[];
    rootSettings: RootSettings;
    currentFolderId: string | null;

    // Load data from DB
    loadNotesInFolder: (folderId: string | null) => void;
    loadFoldersInFolder: (parentId: string | null) => void;
    refreshCurrentFolder: () => void;

    // Note operations
    createNote: (folderId: string | null) => NoteMetadata;
    updateNote: (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>) => void;
    deleteNote: (noteId: string) => void;
    permanentlyDeleteNote: (noteId: string) => void;
    restoreNote: (noteId: string, targetFolderId?: string | null) => void;
    getNoteById: (noteId: string) => NoteMetadata | undefined;

    // Content operations (lazy loaded)
    getNoteContent: (noteId: string) => string;
    updateNoteContent: (noteId: string, content: string) => void;

    // Folder operations
    createFolder: (parentId: string | null, name: string, icon?: string) => Folder;
    updateFolder: (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => void;
    deleteFolder: (folderId: string) => void;
    permanentlyDeleteFolder: (folderId: string) => void;
    restoreFolder: (folderId: string, targetParentId?: string | null) => void;
    getFolderById: (folderId: string) => Folder | undefined;

    // Trash operations
    emptyTrash: () => void;

    // Sorting
    setFolderSortType: (folderId: string | null, sortType: SortType) => void;
    getSortType: (folderId: string | null) => SortType;

    // Getters (operate on cached state)
    getNotesInFolder: (folderId: string | null, includeDeleted?: boolean) => NoteMetadata[];
    getFoldersInFolder: (parentId: string | null, includeDeleted?: boolean) => Folder[];
}

export const useNotesStore = create<NotesState>((set, get) => ({
    // Initial state (empty, will be populated from DB)
    notes: [],
    folders: [],
    rootSettings: { sortType: 'UPDATED_LAST' },
    currentFolderId: null,

    // Load notes from database for a specific folder
    loadNotesInFolder: (folderId: string | null) => {
        const notes = notesRepo.getNotesInFolder(folderId);
        set({ notes, currentFolderId: folderId });
    },

    // Load folders from database for a specific parent
    loadFoldersInFolder: (parentId: string | null) => {
        const folders = foldersRepo.getFoldersInFolder(parentId);
        set({ folders });
    },

    // Refresh current folder data
    refreshCurrentFolder: () => {
        const { currentFolderId } = get();
        const notes = notesRepo.getNotesInFolder(currentFolderId);
        const folders = foldersRepo.getFoldersInFolder(currentFolderId);
        set({ notes, folders });
    },

    // Note operations
    createNote: (folderId: string | null) => {
        const note = notesRepo.createNoteMetadata(folderId);
        // Refresh if we're in the same folder
        if (get().currentFolderId === folderId) {
            get().refreshCurrentFolder();
        }
        return note;
    },

    updateNote: (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>) => {
        notesRepo.updateNoteMetadata(noteId, updates);
        get().refreshCurrentFolder();
    },

    deleteNote: (noteId: string) => {
        notesRepo.softDeleteNote(noteId);
        get().refreshCurrentFolder();
    },

    permanentlyDeleteNote: (noteId: string) => {
        notesRepo.permanentlyDeleteNote(noteId);
        get().refreshCurrentFolder();
    },

    restoreNote: (noteId: string, targetFolderId?: string | null) => {
        notesRepo.restoreNote(noteId, targetFolderId);
        get().refreshCurrentFolder();
    },

    getNoteById: (noteId: string) => {
        // First check cached notes
        const cached = get().notes.find((n) => n.id === noteId);
        if (cached) return cached;

        // Fallback to DB query
        const note = notesRepo.getNoteMetadataById(noteId);
        return note ?? undefined;
    },

    // Content operations
    getNoteContent: (noteId: string) => {
        return notesRepo.getNoteContent(noteId);
    },

    updateNoteContent: (noteId: string, content: string) => {
        notesRepo.updateNoteContent(noteId, content);
        // Note: This also updates preview in metadata
        get().refreshCurrentFolder();
    },

    // Folder operations
    createFolder: (parentId: string | null, name: string, icon: string = 'folder') => {
        const folder = foldersRepo.createFolder(parentId, name, icon);
        if (get().currentFolderId === parentId) {
            get().refreshCurrentFolder();
        }
        return folder;
    },

    updateFolder: (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => {
        foldersRepo.updateFolder(folderId, updates);
        get().refreshCurrentFolder();
    },

    deleteFolder: (folderId: string) => {
        foldersRepo.softDeleteFolder(folderId);
        get().refreshCurrentFolder();
    },

    permanentlyDeleteFolder: (folderId: string) => {
        foldersRepo.permanentlyDeleteFolder(folderId);
        get().refreshCurrentFolder();
    },

    restoreFolder: (folderId: string, targetParentId?: string | null) => {
        foldersRepo.restoreFolder(folderId, targetParentId);
        get().refreshCurrentFolder();
    },

    getFolderById: (folderId: string) => {
        // First check cached folders
        const cached = get().folders.find((f) => f.id === folderId);
        if (cached) return cached;

        // Fallback to DB query
        const folder = foldersRepo.getFolderById(folderId);
        return folder ?? undefined;
    },

    // Trash operations
    emptyTrash: () => {
        foldersRepo.emptyTrash();
        get().refreshCurrentFolder();
    },

    // Sorting
    setFolderSortType: (folderId: string | null, sortType: SortType) => {
        if (folderId === null) {
            set({ rootSettings: { sortType } });
        } else {
            foldersRepo.updateFolder(folderId, { sortType });
            get().refreshCurrentFolder();
        }
    },

    getSortType: (folderId: string | null) => {
        if (folderId === null) {
            return get().rootSettings.sortType;
        }
        const folder = get().getFolderById(folderId);
        return (folder?.sortType as SortType) ?? 'UPDATED_LAST';
    },

    // Getters (operate on cached state with sorting)
    getNotesInFolder: (folderId: string | null, includeDeleted = false) => {
        const { notes } = get();
        const sortType = get().getSortType(folderId);

        const filtered = notes.filter((note) => {
            const folderMatch = note.folderId === folderId;
            const deletedMatch = includeDeleted ? true : !note.isDeleted;
            return folderMatch && deletedMatch;
        });

        // Convert to the format expected by sortNotes
        const notesForSort = filtered.map(n => ({
            ...n,
            content: '', // Not needed for sorting
        }));

        return sortNotes(notesForSort, sortType) as unknown as NoteMetadata[];
    },

    getFoldersInFolder: (parentId: string | null, includeDeleted = false) => {
        const { folders } = get();
        const sortType = get().getSortType(parentId);

        const filtered = folders.filter((folder) => {
            const parentMatch = folder.parentId === parentId;
            const deletedMatch = includeDeleted ? true : !folder.isDeleted;
            return parentMatch && deletedMatch;
        });

        return sortFolders(filtered as any, sortType) as unknown as Folder[];
    },
}));
