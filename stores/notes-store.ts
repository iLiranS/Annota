import {
    DUMMY_FOLDERS,
    DUMMY_NOTES,
    Folder,
    Note,
    SortType,
    TRASH_FOLDER_ID,
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
    deleteNote: (noteId: string) => void; // Soft delete - moves to trash
    permanentlyDeleteNote: (noteId: string) => void; // Hard delete - removes from store
    restoreNote: (noteId: string, targetFolderId?: string | null) => void;
    getNoteById: (noteId: string) => Note | undefined;

    // Folder operations
    createFolder: (parentId: string | null, name: string, icon: string) => Folder;
    updateFolder: (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => void;
    deleteFolder: (folderId: string) => void; // Soft delete - moves to trash recursively
    permanentlyDeleteFolder: (folderId: string) => void; // Hard delete - removes from store
    restoreFolder: (folderId: string, targetParentId?: string | null) => void; // Restores folder and all children
    getFolderById: (folderId: string) => Folder | undefined;

    // Trash operations
    emptyTrash: () => void; // Permanently deletes all deleted items

    // Sorting
    setFolderSortType: (folderId: string | null, sortType: SortType) => void;
    getSortType: (folderId: string | null) => SortType;

    // Getters for notes/folders in a specific folder
    getNotesInFolder: (folderId: string | null, includeDeleted?: boolean) => Note[];
    getFoldersInFolder: (parentId: string | null, includeDeleted?: boolean) => Folder[];
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
            isDeleted: false,
            deletedAt: null,
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
        // Soft delete - mark as deleted and set timestamp
        const note = get().notes.find((n) => n.id === noteId);
        if (!note) return;

        const now = new Date();
        set((state) => ({
            notes: state.notes.map((n) =>
                n.id === noteId
                    ? {
                        ...n,
                        isDeleted: true,
                        deletedAt: now,
                        originalFolderId: n.folderId, // Save original location
                        folderId: TRASH_FOLDER_ID,
                        updatedAt: now
                    }
                    : n
            ),
        }));
    },

    permanentlyDeleteNote: (noteId: string) => {
        // Hard delete - actually remove from array
        set((state) => ({
            notes: state.notes.filter((note) => note.id !== noteId),
        }));
    },

    restoreNote: (noteId: string, targetFolderId?: string | null) => {
        // Restore from trash
        const note = get().notes.find((n) => n.id === noteId);
        if (!note) return;

        const now = new Date();

        // Determine restore location
        let restoredFolderId: string | null = null;
        if (targetFolderId !== undefined) {
            restoredFolderId = targetFolderId;
        } else if (note.originalFolderId) {
            // Check if original folder exists and is not deleted
            const originalFolder = get().folders.find((f) => f.id === note.originalFolderId);
            if (originalFolder && !originalFolder.isDeleted) {
                restoredFolderId = note.originalFolderId;
            }
            // Otherwise restore to root (null)
        }

        set((state) => ({
            notes: state.notes.map((n) =>
                n.id === noteId
                    ? {
                        ...n,
                        isDeleted: false,
                        deletedAt: null,
                        folderId: restoredFolderId,
                        originalFolderId: undefined, // Clear original location
                        updatedAt: now
                    }
                    : n
            ),
        }));
    },

    getNoteById: (noteId: string) => {
        return get().notes.find((note) => note.id === noteId);
    },

    // Folder operations
    createFolder: (parentId: string | null, name: string, icon: string = 'folder') => {
        const now = new Date();
        const newFolder: Folder = {
            id: generateId(),
            name,
            icon,
            parentId,
            sortType: 'UPDATED_LAST',
            isSystem: false,
            isDeleted: false,
            deletedAt: null,
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
        // Soft delete - mark folder and all descendants as deleted
        const getAllFolderIds = (id: string): string[] => {
            const childFolders = get().folders.filter((f) => f.parentId === id && !f.isDeleted);
            return [id, ...childFolders.flatMap((f) => getAllFolderIds(f.id))];
        };

        const folderIdsToDelete = getAllFolderIds(folderId);
        const folder = get().folders.find((f) => f.id === folderId);

        // Prevent deleting system folders (Trash)
        if (folder?.isSystem) return;

        const now = new Date();

        set((state) => ({
            // Mark all child folders as deleted and save original locations
            folders: state.folders.map((f) => {
                if (folderIdsToDelete.includes(f.id)) {
                    return {
                        ...f,
                        isDeleted: true,
                        deletedAt: now,
                        originalParentId: f.parentId, // Save original parent
                        parentId: f.id === folderId ? TRASH_FOLDER_ID : f.parentId, // Only top folder moves to trash
                        updatedAt: now,
                    };
                }
                return f;
            }),
            // Mark all notes in deleted folders as deleted and save original locations
            notes: state.notes.map((n) => {
                if (n.folderId && folderIdsToDelete.includes(n.folderId)) {
                    return {
                        ...n,
                        isDeleted: true,
                        deletedAt: now,
                        originalFolderId: n.folderId, // Save original folder
                        updatedAt: now,
                    };
                }
                return n;
            }),
        }));
    },

    permanentlyDeleteFolder: (folderId: string) => {
        // Hard delete - actually remove folder and all descendants from array
        const getAllFolderIds = (id: string): string[] => {
            const childFolders = get().folders.filter((f) => f.parentId === id);
            return [id, ...childFolders.flatMap((f) => getAllFolderIds(f.id))];
        };

        const folderIdsToDelete = getAllFolderIds(folderId);

        set((state) => ({
            folders: state.folders.filter((f) => !folderIdsToDelete.includes(f.id)),
            notes: state.notes.filter((n) => !n.folderId || !folderIdsToDelete.includes(n.folderId)),
        }));
    },

    restoreFolder: (folderId: string, targetParentId?: string | null) => {
        // Restore folder and all its children (cascade restore)
        const getAllFolderIds = (id: string): string[] => {
            const childFolders = get().folders.filter((f) => f.parentId === id);
            return [id, ...childFolders.flatMap((f) => getAllFolderIds(f.id))];
        };

        const folderIdsToRestore = getAllFolderIds(folderId);
        const topFolder = get().folders.find((f) => f.id === folderId);
        const now = new Date();

        // Determine where to restore the top-level folder
        let restoredParentId: string | null = null;
        if (targetParentId !== undefined) {
            restoredParentId = targetParentId;
        } else if (topFolder?.originalParentId) {
            // Check if original parent exists and is not deleted
            const originalParent = get().folders.find((f) => f.id === topFolder.originalParentId);
            if (originalParent && !originalParent.isDeleted) {
                restoredParentId = topFolder.originalParentId;
            }
            // Otherwise restore to root (null)
        }

        set((state) => ({
            // Restore all child folders to original locations
            folders: state.folders.map((f) => {
                if (folderIdsToRestore.includes(f.id)) {
                    // For top folder, use validated restoredParentId
                    // For child folders, check if their original parent is being restored too
                    let newParentId: string | null;
                    if (f.id === folderId) {
                        newParentId = restoredParentId;
                    } else {
                        // Child folder - restore to original parent if it's in the restore set, otherwise keep current
                        const originalParent = f.originalParentId ?? f.parentId;
                        if (originalParent && folderIdsToRestore.includes(originalParent)) {
                            newParentId = originalParent;
                        } else {
                            newParentId = f.parentId;
                        }
                    }

                    return {
                        ...f,
                        isDeleted: false,
                        deletedAt: null,
                        parentId: newParentId,
                        originalParentId: undefined, // Clear original location
                        updatedAt: now,
                    };
                }
                return f;
            }),
            // Restore all notes in restored folders to original locations
            notes: state.notes.map((n) => {
                if (n.folderId && folderIdsToRestore.includes(n.folderId)) {
                    return {
                        ...n,
                        isDeleted: false,
                        deletedAt: null,
                        folderId: n.originalFolderId ?? n.folderId, // Restore to original folder
                        originalFolderId: undefined, // Clear original location
                        updatedAt: now,
                    };
                }
                return n;
            }),
        }));
    },

    getFolderById: (folderId: string) => {
        return get().folders.find((folder) => folder.id === folderId);
    },

    // Trash operations
    emptyTrash: () => {
        // Permanently delete all items marked as deleted
        set((state) => ({
            notes: state.notes.filter((n) => !n.isDeleted),
            folders: state.folders.filter((f) => !f.isDeleted),
        }));
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
    getNotesInFolder: (folderId: string | null, includeDeleted = false) => {
        return get().notes.filter((note) => {
            const folderMatch = note.folderId === folderId;
            const deletedMatch = includeDeleted ? true : !note.isDeleted;
            return folderMatch && deletedMatch;
        });
    },

    getFoldersInFolder: (parentId: string | null, includeDeleted = false) => {
        return get().folders.filter((folder) => {
            const parentMatch = folder.parentId === parentId;
            const deletedMatch = includeDeleted ? true : !folder.isDeleted;
            // Show all folders including system folders like Trash at root level
            return parentMatch && deletedMatch;
        });
    },
}));
