import {
    DUMMY_FOLDERS,
    DUMMY_NOTES,
    Folder,
    Note,
    SortType,
} from '@/dev-data/data';
import { create } from 'zustand';

// Generate unique IDs
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Root folder sorting preference (stored separately since root has no folder entity)
interface RootSettings {
    sortType: SortType;
}

interface NotesState {
    // Data
    notes: Note[];
    folders: Folder[];
    rootSettings: RootSettings;

    // Note operations
    createNote: (folderId: string | null) => Note;
    updateNote: (noteId: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
    deleteNote: (noteId: string) => void;
    getNoteById: (noteId: string) => Note | undefined;

    // Folder operations
    createFolder: (parentId: string | null, name: string) => Folder;
    updateFolder: (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => void;
    deleteFolder: (folderId: string) => void;
    getFolderById: (folderId: string) => Folder | undefined;

    // Sorting
    setFolderSortType: (folderId: string | null, sortType: SortType) => void;
    getSortType: (folderId: string | null) => SortType;

    // Getters for notes/folders in a specific folder
    getNotesInFolder: (folderId: string | null) => Note[];
    getFoldersInFolder: (parentId: string | null) => Folder[];
}

export const useNotesStore = create<NotesState>((set, get) => ({
    // Initial data from dummy data
    notes: [...DUMMY_NOTES],
    folders: [...DUMMY_FOLDERS],
    rootSettings: { sortType: 'UPDATED_LAST' },

    // Note operations
    createNote: (folderId: string | null) => {
        const now = new Date();
        const newNote: Note = {
            id: generateId(),
            title: 'Untitled Note',
            content: '',
            preview: '',
            folderId,
            createdAt: now,
            updatedAt: now,
        };
        set((state) => ({
            notes: [...state.notes, newNote],
        }));
        return newNote;
    },

    updateNote: (noteId: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
        set((state) => ({
            notes: state.notes.map((note) =>
                note.id === noteId
                    ? { ...note, ...updates, updatedAt: new Date() }
                    : note
            ),
        }));
    },

    deleteNote: (noteId: string) => {
        set((state) => ({
            notes: state.notes.filter((note) => note.id !== noteId),
        }));
    },

    getNoteById: (noteId: string) => {
        return get().notes.find((note) => note.id === noteId);
    },

    // Folder operations
    createFolder: (parentId: string | null, name: string) => {
        const now = new Date();
        const newFolder: Folder = {
            id: generateId(),
            name,
            parentId,
            sortType: 'UPDATED_LAST',
            createdAt: now,
            updatedAt: now,
        };
        set((state) => ({
            folders: [...state.folders, newFolder],
        }));
        return newFolder;
    },

    updateFolder: (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => {
        set((state) => ({
            folders: state.folders.map((folder) =>
                folder.id === folderId
                    ? { ...folder, ...updates, updatedAt: new Date() }
                    : folder
            ),
        }));
    },

    deleteFolder: (folderId: string) => {
        // Also delete notes in this folder and subfolders
        const getAllFolderIds = (id: string): string[] => {
            const childFolders = get().folders.filter((f) => f.parentId === id);
            return [id, ...childFolders.flatMap((f) => getAllFolderIds(f.id))];
        };

        const folderIdsToDelete = getAllFolderIds(folderId);

        set((state) => ({
            folders: state.folders.filter((f) => !folderIdsToDelete.includes(f.id)),
            notes: state.notes.filter((n) => n.folderId === null || !folderIdsToDelete.includes(n.folderId)),
        }));
    },

    getFolderById: (folderId: string) => {
        return get().folders.find((folder) => folder.id === folderId);
    },

    // Sorting
    setFolderSortType: (folderId: string | null, sortType: SortType) => {
        if (folderId === null) {
            // Root level
            set({ rootSettings: { sortType } });
        } else {
            set((state) => ({
                folders: state.folders.map((folder) =>
                    folder.id === folderId
                        ? { ...folder, sortType, updatedAt: new Date() }
                        : folder
                ),
            }));
        }
    },

    getSortType: (folderId: string | null) => {
        if (folderId === null) {
            return get().rootSettings.sortType;
        }
        const folder = get().folders.find((f) => f.id === folderId);
        return folder?.sortType ?? 'UPDATED_LAST';
    },

    // Getters
    getNotesInFolder: (folderId: string | null) => {
        return get().notes.filter((note) => note.folderId === folderId);
    },

    getFoldersInFolder: (parentId: string | null) => {
        return get().folders.filter((folder) => folder.parentId === parentId);
    },
}));
