import { create } from 'zustand';
import { purgeGuestTombstones, vacuumDatabase } from '../db';
import type { Folder, FolderInsert, NoteMetadata, Tag } from '../db/schema';
import { DAILY_NOTES_FOLDER_ID, FolderService, TRASH_FOLDER_ID } from '../services/folders.service';
import { NoteService } from '../services/notes.service';
import { TagService } from '../services/tags.service';
import { SyncScheduler } from '../sync/sync-scheduler';
import { SortType, sortFolders, sortNotes } from '../utils/sorts';
import { generateRandomHexColor } from '../utils/tags';
import { useUserStore } from './user.store';


// Re-export types for convenience
export { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID };
export type { Folder, NoteMetadata, Tag };

// Root folder sorting preference (stored separately since root has no folder entity)
interface RootSettings {
    sortType: SortType;
}

interface NotesState {
    // Data (All cached in memory - "Aggressive Caching")
    notes: NoteMetadata[];
    folders: Folder[];
    tags: Tag[];
    rootSettings: RootSettings;
    isInitialized: boolean;

    // Initialization
    initApp: () => Promise<void>;

    // Note operations
    createNote: (data: Partial<NoteMetadata>) => Promise<{ data: NoteMetadata | null, error: string | null }>;
    updateNoteMetadata: (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>) => Promise<void>;
    deleteNote: (noteId: string) => Promise<void>;
    permanentlyDeleteNote: (noteId: string) => Promise<void>;
    restoreNote: (noteId: string, targetFolderId?: string | null) => Promise<void>;
    getNoteById: (noteId: string) => NoteMetadata | undefined;

    // Tag operations
    addTagToNote: (noteId: string, tag: { id?: string, name: string, color?: string }) => Promise<{ error: string | null }>;
    removeTagFromNote: (noteId: string, tagId: string) => Promise<void>;
    updateTag: (tagId: string, updates: Partial<Omit<Tag, 'id'>>) => Promise<void>;
    deleteTag: (tagId: string) => Promise<void>;

    // Content operations (lazy loaded)
    getNoteContent: (noteId: string) => Promise<string>;
    updateNoteContent: (noteId: string, content: string) => Promise<void>;
    getNoteVersions: (noteId: string) => Promise<{ id: string; createdAt: Date }[]>;
    getNoteVersion: (versionId: string) => Promise<{ id: string; content: string; createdAt: Date } | undefined>;
    deleteNoteVersion: (noteId: string, versionId: string) => Promise<void>;
    deleteAllVersionsExceptLatest: (noteId: string) => Promise<void>;
    revertNote: (noteId: string, versionId: string) => Promise<void>;

    // Folder operations
    createFolder: (data: Partial<FolderInsert>) => Promise<{ data: Folder | null, error: string | null }>;
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


    // Reset store
    reset: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
    // Initial state (empty, will be populated from DB)
    notes: [],
    folders: [],
    tags: [],
    rootSettings: { sortType: 'UPDATED_LAST' },
    isInitialized: false,

    // Initialize App - Load ALL data on startup
    initApp: async () => {
        const wasInitialized = get().isInitialized;

        // 1. Run Maintenance FIRST, only on cold starts
        if (!wasInitialized) {
            console.log('[Store] Running startup database maintenance...');
            try {
                // Assuming vacuumDatabase is imported at the top of your store file
                await vacuumDatabase();
                await purgeGuestTombstones();
            } catch (err) {
                console.warn('[Store] Startup maintenance failed, continuing init...', err);
            }
        }

        // 2. Now it is completely safe to open read cursors
        const allFolders = await FolderService.getFoldersInFolder(null, true);
        const allNotes = await NoteService.getNotesInFolder(null, true);
        const allTags = await TagService.getAllTags();

        // Recursively load all folders
        const loadAllFolders = async (): Promise<Folder[]> => {
            const result: Folder[] = [];
            const queue = [...allFolders];

            while (queue.length > 0) {
                const folder = queue.shift()!;
                result.push(folder);
                const children = await FolderService.getFoldersInFolder(folder.id, true);
                queue.push(...children);
            }

            return result;
        };

        // Recursively load all notes
        const loadAllNotes = async (): Promise<NoteMetadata[]> => {
            const result: NoteMetadata[] = [...allNotes];
            const allFoldersData = await loadAllFolders();

            for (const folder of allFoldersData) {
                const notes = await NoteService.getNotesInFolder(folder.id, true);
                result.push(...notes);
            }

            return result;
        };

        const baseFolders = await loadAllFolders();
        const baseNotes = await loadAllNotes(); // Pulls the regular notes

        // We MUST pull virtual folders because "system-trash" isn't caught by loadAllNotes
        const trashFolders = await FolderService.getFoldersInFolder(TRASH_FOLDER_ID, true);
        const trashNotes = await NoteService.getNotesInFolder(TRASH_FOLDER_ID, true);
        const dailyNotes = await NoteService.getNotesInFolder(DAILY_NOTES_FOLDER_ID, true);

        // Deduplicate Folders
        const allFetchedFolders = [...baseFolders, ...trashFolders];
        const uniqueFoldersMap = new Map();
        allFetchedFolders.forEach((f) => uniqueFoldersMap.set(f.id, f));
        const folders = Array.from(uniqueFoldersMap.values());

        // Combine everything
        const allFetchedNotes = [...baseNotes, ...trashNotes, ...dailyNotes];

        // DEDUPLICATE: This prevents the "11 notes" bug by ensuring IDs are unique
        const uniqueNotesMap = new Map();
        allFetchedNotes.forEach((note) => uniqueNotesMap.set(note.id, note));
        const notes = Array.from(uniqueNotesMap.values());

        set({ folders, notes, tags: allTags, isInitialized: true });

        if (!wasInitialized) {
            console.log(`[Store] Initialized with ${folders.length} folders and ${notes.length} notes.`);
        } else {
            console.log(`[Store] Reinitialized with ${folders.length} folders and ${notes.length} notes from local database.`);
        }
    },

    // ============ NOTE OPERATIONS ============

    createNote: async (data: Partial<NoteMetadata>) => {
        try {
            // 1. Service Call (writes to DB)
            const userState = useUserStore.getState();
            const newNote = await NoteService.create(data, userState.role, userState.sub_exp_date);

            // 2. Manual State Mutation (update local cache)
            set(state => {
                const exists = state.notes.some(n => n.id === newNote.id);
                if (exists) return state;
                return {
                    notes: [...state.notes, newNote]
                };
            });

            SyncScheduler.instance?.notifyContentChange();
            return { data: newNote, error: null };
        } catch (error) {
            console.error('[Store] Failed to create note:', error);
            return { data: null, error: error instanceof Error ? error.message : String(error) };
        }
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
        const restoredNote = await NoteService.getNoteById(noteId);

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

    // ============ TAG OPERATIONS ============

    addTagToNote: async (noteId, tag) => {
        try {
            const color = tag.color ?? generateRandomHexColor();
            const userState = useUserStore.getState();
            const result = await NoteService.addTag(noteId, { ...tag, color }, userState.role, userState.sub_exp_date);
            if (result) {
                const { note: updatedNote, tag: persistedTag } = result;
                set(state => {
                    const isNewTag = !state.tags.find(t => t.id === persistedTag.id);
                    const newTags = isNewTag ? [...state.tags, persistedTag] : state.tags;
                    return {
                        notes: state.notes.map(n => n.id === noteId ? updatedNote : n),
                        tags: newTags
                    };
                });
                SyncScheduler.instance?.notifyContentChange();
            }
            return { error: null };
        } catch (error) {
            console.error('[Store] Failed to add tag:', error);
            return { error: error instanceof Error ? error.message : String(error) };
        }
    },

    removeTagFromNote: async (noteId, tagId) => {
        const updatedNote = await NoteService.removeTag(noteId, tagId);
        if (updatedNote) {
            set(state => ({
                notes: state.notes.map(n => n.id === noteId ? updatedNote : n)
            }));
            SyncScheduler.instance?.notifyContentChange();
        }
    },

    updateTag: async (tagId, updates) => {
        const updatedTag = await TagService.update(tagId, updates);
        set(state => ({
            tags: state.tags.map(t => t.id === tagId ? updatedTag : t)
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    deleteTag: async (tagId) => {
        // 1. Cascade: remove tag from notes in DB + soft-delete the tag (marks dirty for sync)
        await TagService.delete(tagId);

        // 2. Update in-memory state immediately (remove tag from store + clean notes)
        set(state => {
            const newTags = state.tags.filter(t => t.id !== tagId);
            const newNotes = state.notes.map(note => {
                const tagIds = JSON.parse(note.tags || '[]') as string[];
                if (tagIds.includes(tagId)) {
                    const updatedTagIds = tagIds.filter(id => id !== tagId);
                    return { ...note, tags: JSON.stringify(updatedTagIds) };
                }
                return note;
            });
            return { tags: newTags, notes: newNotes };
        });

        // 3. Trigger sync push so the dirty deleted tag reaches Supabase.
        //    The scheduler handles the actual push + local tombstone cleanup.
        SyncScheduler.instance?.notifyContentChange();
    },

    // ============ CONTENT OPERATIONS ============

    getNoteContent: (noteId) => {
        // Content is heavy, still lazy loaded from DB
        return NoteService.getNoteContent(noteId);
    },

    updateNoteContent: async (noteId, content) => {
        await NoteService.updateContent(noteId, content);

        // Fetch updated metadata (with new preview)
        const updatedNote = await NoteService.getNoteById(noteId);
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

    deleteAllVersionsExceptLatest: async (noteId) => {
        await NoteService.deleteAllVersionsExceptLatest(noteId);
        // Note: component handles refetching versions since they aren't part of zustand's persistent state.
    },

    // ============ FOLDER OPERATIONS ============

    createFolder: async (data: Partial<FolderInsert>) => {
        try {
            const userState = useUserStore.getState();
            const newFolder = await FolderService.create(data, userState.role, userState.sub_exp_date);

            set(state => ({
                folders: [...state.folders, newFolder]
            }));

            SyncScheduler.instance?.notifyContentChange();
            return { data: newFolder, error: null };
        } catch (error) {
            console.error('[Store] Failed to create folder:', error);
            return { data: null, error: error instanceof Error ? error.message : String(error) };
        }
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
                        folderId: TRASH_FOLDER_ID,
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


    // ============ SORTING & GETTERS ============

    setFolderSortType: (folderId, sortType) => {
        if (folderId === null) {
            set({ rootSettings: { sortType } });
        } else {
            get().updateFolder(folderId, { sortType });
        }
        SyncScheduler.instance?.notifyContentChange();
    },

    getSortType: (folderId) => {
        if (folderId === null) {
            return get().rootSettings.sortType;
        }
        const folder = get().getFolderById(folderId);
        return (folder?.sortType as SortType) ?? 'UPDATED_LAST';
    },

    getNotesInFolder: (folderId, includeDeleted = false) => {
        const { notes, folders } = get();
        const sortType = get().getSortType(folderId);

        // Helper to safely compare Date objects, strings, or numbers
        const getTs = (d: any) => d ? new Date(d).getTime() : 0;

        const filtered = notes.filter((note) => {
            // 1. Browsing the Trash Root
            if (folderId === TRASH_FOLDER_ID) {
                if (!note.isDeleted) return false;

                // Show if originally at the root
                if (!note.originalFolderId) return true;

                const origFolder = folders.find(f => f.id === note.originalFolderId);

                // Show if original folder is hard-deleted or still active
                if (!origFolder || !origFolder.isDeleted) return true;

                // 🚨 NEW: Timestamp Comparison
                // If note was deleted strictly BEFORE the folder, it's an independent deletion.
                const noteDeletedTs = getTs(note.deletedAt);
                const folderDeletedTs = getTs(origFolder.deletedAt);
                return noteDeletedTs < folderDeletedTs;
            }

            // 2. Virtual Folder Override: DAILY NOTES
            if (folderId === DAILY_NOTES_FOLDER_ID) {
                return note.folderId === DAILY_NOTES_FOLDER_ID && (includeDeleted ? true : !note.isDeleted);
            }

            // 3. Browsing INSIDE a deleted folder
            if (note.isDeleted) {
                if (!includeDeleted) return false;
                if (note.originalFolderId !== folderId) return false;

                // 🚨 NEW: Hide independent deletions from inside the reconstructed folder
                const origFolder = folders.find(f => f.id === folderId);
                if (origFolder && origFolder.isDeleted) {
                    const noteDeletedTs = getTs(note.deletedAt);
                    const folderDeletedTs = getTs(origFolder.deletedAt);

                    // If note was deleted before the folder, it doesn't belong here anymore
                    if (noteDeletedTs < folderDeletedTs) return false;
                }

                return true;
            }

            // 4. Standard active notes
            const folderMatch = note.folderId === folderId;
            const deletedMatch = includeDeleted ? true : !note.isDeleted;
            return folderMatch && deletedMatch;
        });

        return sortNotes(filtered, sortType);
    },

    getFoldersInFolder: (parentId, includeDeleted = false) => {
        const { folders } = get();
        const sortType = get().getSortType(parentId);

        const getTs = (d: any) => d ? new Date(d).getTime() : 0;

        const filtered = folders.filter((folder) => {
            // 1. Browsing the Trash Root
            if (parentId === TRASH_FOLDER_ID) {
                if (!folder.isDeleted) return false;
                if (!folder.originalParentId) return true;

                const origParent = folders.find(f => f.id === folder.originalParentId);
                if (!origParent || !origParent.isDeleted) return true;

                // Timestamp check for nested folders
                const folderDeletedTs = getTs(folder.deletedAt);
                const parentDeletedTs = getTs(origParent.deletedAt);
                return folderDeletedTs < parentDeletedTs;
            }

            // 2. Browsing INSIDE a deleted folder
            if (folder.isDeleted) {
                if (!includeDeleted) return false;
                if (folder.originalParentId !== parentId) return false;

                const origParent = folders.find(f => f.id === parentId);
                if (origParent && origParent.isDeleted) {
                    const folderDeletedTs = getTs(folder.deletedAt);
                    const parentDeletedTs = getTs(origParent.deletedAt);
                    if (folderDeletedTs < parentDeletedTs) return false;
                }

                return true;
            }

            // 3. Standard active folders
            const parentMatch = folder.parentId === parentId;
            const deletedMatch = includeDeleted ? true : !folder.isDeleted;
            return parentMatch && deletedMatch;
        });

        return sortFolders(filtered, sortType);
    },

    reset: () => {
        set({
            notes: [],
            folders: [],
            tags: [],
            rootSettings: { sortType: 'UPDATED_LAST' },
            isInitialized: false,
        });
    },
}));
