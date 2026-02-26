import { SortType, sortFolders, sortNotes } from '@/dev-data/data';
import type { Folder, FolderInsert, NoteMetadata } from '@/lib/db/schema';
import { DAILY_NOTES_FOLDER_ID, FolderService, TRASH_FOLDER_ID } from '@/lib/services/folders.service';
import { NoteService } from '@/lib/services/notes.service';
import { SyncScheduler } from '@/lib/sync/sync-scheduler';
import { create } from 'zustand';

// Re-export types for convenience
export { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID };
export type { Folder, NoteMetadata };

// Root folder sorting preference (stored separately since root has no folder entity)
interface RootSettings {
    sortType: SortType;
}

interface NotesState {
    // Data (All cached in memory - "Aggressive Caching")
    notes: NoteMetadata[];
    folders: Folder[];
    rootSettings: RootSettings;
    isInitialized: boolean;

    // Initialization
    initApp: () => void;

    // Note operations
    createNote: (data: Partial<NoteMetadata>) => Promise<NoteMetadata>;
    updateNoteMetadata: (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>) => Promise<void>;
    deleteNote: (noteId: string) => Promise<void>;
    permanentlyDeleteNote: (noteId: string) => Promise<void>;
    restoreNote: (noteId: string, targetFolderId?: string | null) => Promise<void>;
    getNoteById: (noteId: string) => NoteMetadata | undefined;

    // Content operations (lazy loaded)
    // Content operations (lazy loaded)
    getNoteContent: (noteId: string) => string;
    updateNoteContent: (noteId: string, content: string) => Promise<void>;
    getNoteVersions: (noteId: string) => Promise<{ id: string; createdAt: Date }[]>;
    getNoteVersion: (versionId: string) => Promise<{ id: string; content: string; createdAt: Date } | undefined>;
    deleteNoteVersion: (noteId: string, versionId: string) => Promise<void>;
    revertNote: (noteId: string, versionId: string) => Promise<void>;

    // Folder operations
    createFolder: (data: Partial<FolderInsert>) => Promise<Folder>;
    updateFolder: (folderId: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => Promise<void>;
    deleteFolder: (folderId: string) => Promise<void>;
    permanentlyDeleteFolder: (folderId: string) => Promise<void>;
    restoreFolder: (folderId: string) => Promise<void>;
    getFolderById: (folderId: string) => Folder | undefined;

    // Trash operations
    emptyTrash: () => Promise<void>;

    // Sorting
    setFolderSortType: (folderId: string | null, sortType: SortType) => void;
    getSortType: (folderId: string | null) => SortType;

    // Getters (operate on cached state)
    getNotesInFolder: (folderId: string | null, includeDeleted?: boolean) => NoteMetadata[];
    getFoldersInFolder: (parentId: string | null, includeDeleted?: boolean) => Folder[];

    // Daily Notes
    getOrCreateDailyNote: () => Promise<string>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
    // Initial state (empty, will be populated from DB)
    notes: [],
    folders: [],
    rootSettings: { sortType: 'UPDATED_LAST' },
    isInitialized: false,

    // Initialize App - Load ALL data on startup
    initApp: () => {
        const allFolders = FolderService.getFoldersInFolder(null, true);
        const allNotes = NoteService.getNotesInFolder(null, true);

        // Recursively load all folders
        const loadAllFolders = (): Folder[] => {
            const result: Folder[] = [];
            const queue = [...allFolders];

            while (queue.length > 0) {
                const folder = queue.shift()!;
                result.push(folder);
                const children = FolderService.getFoldersInFolder(folder.id, true);
                queue.push(...children);
            }

            return result;
        };

        // Recursively load all notes
        const loadAllNotes = (): NoteMetadata[] => {
            const result: NoteMetadata[] = [...allNotes];
            const allFoldersData = loadAllFolders();

            for (const folder of allFoldersData) {
                const notes = NoteService.getNotesInFolder(folder.id, true);
                result.push(...notes);
            }

            return result;
        };

        const folders = loadAllFolders();
        const notes = loadAllNotes();

        const wasInitialized = get().isInitialized;
        set({ folders, notes, isInitialized: true });

        if (!wasInitialized) {
            console.log(`[Store] Initialized with ${folders.length} folders and ${notes.length} notes.`);
        } else {
            console.log(`[Store] Reinitialized with ${folders.length} folders and ${notes.length} notes from local database.`);
        }

    },

    // ============ NOTE OPERATIONS ============

    createNote: async (data: Partial<NoteMetadata>) => {
        // 1. Service Call (writes to DB)
        const newNote = await NoteService.create(data);

        // 2. Manual State Mutation (update local cache)
        set(state => ({
            notes: [...state.notes, newNote]
        }));

        SyncScheduler.instance?.notifyContentChange();
        return newNote;
    },

    updateNoteMetadata: async (noteId, updates) => {
        // 1. Service Call
        const res = await NoteService.updateMetadata(noteId, updates);
        if (!res) return;

        // 2. Manual State Mutation
        set(state => ({
            notes: state.notes.map(n =>
                n.id === noteId ? res : n
            )
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    deleteNote: async (noteId) => {
        // 1. Service Call
        await NoteService.softDelete(noteId);

        // 2. Manual State Mutation
        set(state => ({
            notes: state.notes.map(n =>
                n.id === noteId
                    ? { ...n, isDeleted: true, folderId: 'system-trash', originalFolderId: n.folderId, deletedAt: new Date(), updatedAt: new Date() }
                    : n
            )
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    permanentlyDeleteNote: async (noteId) => {
        await NoteService.permanentlyDelete(noteId);

        set(state => ({
            notes: state.notes.filter(n => n.id !== noteId)
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    restoreNote: async (noteId, targetFolderId) => {
        await NoteService.restore(noteId, targetFolderId);

        // Fetch the updated note to get the correct restored state
        const restoredNote = NoteService.getNoteById(noteId);

        if (restoredNote) {
            set(state => ({
                notes: state.notes.map(n => n.id === noteId ? restoredNote : n)
            }));
        }
        SyncScheduler.instance?.notifyContentChange();
    },

    getNoteById: (noteId) => {
        return get().notes.find(n => n.id === noteId);
    },

    // ============ CONTENT OPERATIONS ============

    getNoteContent: (noteId) => {
        // Content is heavy, still lazy loaded from DB
        return NoteService.getNoteContent(noteId);
    },

    updateNoteContent: async (noteId, content) => {
        await NoteService.updateContent(noteId, content);

        // Fetch updated metadata (with new preview)
        const updatedNote = NoteService.getNoteById(noteId);
        if (updatedNote) {
            set(state => ({
                notes: state.notes.map(n => n.id === noteId ? updatedNote : n)
            }));
        }
        SyncScheduler.instance?.notifyContentChange();
    },

    getNoteVersions: async (noteId) => {
        return NoteService.getVersions(noteId);
    },

    getNoteVersion: async (versionId) => {
        return NoteService.getVersion(versionId);
    },

    revertNote: async (noteId, versionId) => {
        const version = await NoteService.getVersion(versionId);
        if (version) {
            // Treating revert as a new update ("forward roll")
            await get().updateNoteContent(noteId, version.content);
        }
    },

    deleteNoteVersion: async (noteId, versionId) => {
        await NoteService.deleteVersion(noteId, versionId);
    },

    // ============ FOLDER OPERATIONS ============

    createFolder: async (data: Partial<FolderInsert>) => {
        const newFolder = await FolderService.create(data);

        set(state => ({
            folders: [...state.folders, newFolder]
        }));

        SyncScheduler.instance?.notifyContentChange();
        return newFolder;
    },

    updateFolder: async (folderId, updates) => {
        await FolderService.update(folderId, updates);

        set(state => ({
            folders: state.folders.map(f =>
                f.id === folderId ? { ...f, ...updates, updatedAt: new Date() } : f
            )
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    deleteFolder: async (folderId) => {
        // Service handles cascading soft delete and returns deleted IDs
        const deletedIds = await FolderService.softDelete(folderId);

        const now = new Date();

        // Manual State Mutation: Mark all as deleted
        set(state => {
            const newFolders = state.folders.map(f => {
                if (deletedIds.includes(f.id)) {
                    return {
                        ...f,
                        isDeleted: true,
                        deletedAt: now,
                        originalParentId: f.parentId,
                        parentId: f.id === folderId ? TRASH_FOLDER_ID : f.parentId,
                        updatedAt: now
                    };
                }
                return f;
            });

            // Also mark notes in these folders as deleted
            const newNotes = state.notes.map(n => {
                if (n.folderId && deletedIds.includes(n.folderId)) {
                    return {
                        ...n,
                        isDeleted: true,
                        deletedAt: now,
                        originalFolderId: n.folderId,
                        updatedAt: now
                    };
                }
                return n;
            });

            return { folders: newFolders, notes: newNotes };
        });
        SyncScheduler.instance?.notifyContentChange();
    },

    permanentlyDeleteFolder: async (folderId) => {
        // Calculate descendants from local state
        const getLocalDescendants = (rootId: string, allFolders: Folder[]): string[] => {
            const children = allFolders.filter(f => f.parentId === rootId).map(f => f.id);
            const grandChildren = children.flatMap(id => getLocalDescendants(id, allFolders));
            return [...children, ...grandChildren];
        };

        const descendants = getLocalDescendants(folderId, get().folders);
        const allIdsToRemove = [folderId, ...descendants];

        await FolderService.permanentlyDelete(folderId);

        set(state => ({
            folders: state.folders.filter(f => !allIdsToRemove.includes(f.id)),
            notes: state.notes.filter(n => !n.folderId || !allIdsToRemove.includes(n.folderId))
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    restoreFolder: async (folderId) => {
        const { folderIds, noteIds, restoredParentId } = await FolderService.restore(folderId);
        set(state => {
            const now = new Date();

            const newFolders = state.folders.map(f => {
                if (folderId === f.id) {
                    return {
                        ...f,
                        isDeleted: false,
                        deletedAt: null,
                        parentId: restoredParentId,
                        originalParentId: null,
                    };
                }
                if (folderIds.includes(f.id)) {
                    return {
                        ...f,
                        isDeleted: false,
                        deletedAt: null,
                        originalParentId: null,
                    };
                }
                return f;
            });

            const newNotes = state.notes.map(n => {
                if (noteIds.includes(n.id)) {
                    return {
                        ...n,
                        isDeleted: false,
                        deletedAt: null,
                        folderId: n.originalFolderId ?? n.folderId,
                        originalFolderId: null,
                        updatedAt: now
                    };
                }
                return n;
            });

            return { folders: newFolders, notes: newNotes };
        });
        SyncScheduler.instance?.notifyContentChange();
    },

    getFolderById: (folderId) => {
        return get().folders.find(f => f.id === folderId);
    },

    // ============ TRASH ============

    emptyTrash: async () => {
        const success = await FolderService.emptyTrash();

        if (success) {
            set(state => ({
                folders: state.folders.filter(f => !f.isDeleted),
                notes: state.notes.filter(n => !n.isDeleted)
            }));
        }
        SyncScheduler.instance?.notifyContentChange();
    },

    // ============ DAILY NOTES ============

    getOrCreateDailyNote: async () => {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const todayTitle = `${dd}-${mm}-${yyyy}`;

        const { notes, createNote } = get();

        // Find existing note for today
        const existingNote = notes.find(n =>
            n.folderId === DAILY_NOTES_FOLDER_ID &&
            n.title === todayTitle &&
            !n.isDeleted
        );

        if (existingNote) {
            return existingNote.id;
        }

        // Create new daily note
        const newNote = await createNote({
            folderId: DAILY_NOTES_FOLDER_ID,
            title: todayTitle
        });

        return newNote.id;
    },

    // ============ SORTING & GETTERS ============

    setFolderSortType: (folderId, sortType) => {
        if (folderId === null) {
            set({ rootSettings: { sortType } });
        } else {
            get().updateFolder(folderId, { sortType });
        }
    },

    getSortType: (folderId) => {
        if (folderId === null) {
            return get().rootSettings.sortType;
        }
        const folder = get().getFolderById(folderId);
        return (folder?.sortType as SortType) ?? 'UPDATED_LAST';
    },

    getNotesInFolder: (folderId, includeDeleted = false) => {
        const { notes } = get();
        const sortType = get().getSortType(folderId);

        const filtered = notes.filter((note) => {
            const folderMatch = note.folderId === folderId;
            const deletedMatch = includeDeleted ? true : !note.isDeleted;
            return folderMatch && deletedMatch;
        });

        return sortNotes(filtered, sortType);
    },

    getFoldersInFolder: (parentId, includeDeleted = false) => {
        const { folders } = get();
        const sortType = get().getSortType(parentId);

        const filtered = folders.filter((folder) => {
            const parentMatch = folder.parentId === parentId;
            const deletedMatch = includeDeleted ? true : !folder.isDeleted;
            return parentMatch && deletedMatch;
        });

        return sortFolders(filtered, sortType);
    },


}));
