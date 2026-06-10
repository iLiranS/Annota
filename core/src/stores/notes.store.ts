import { create } from 'zustand';
import { COLOR_PALETTE } from '../../constants/colors';
import { getPlatformAdapters } from '../adapters';
import { purgeGuestTombstones, type PendingTaskNote } from '../db';
import { normalizeStoredContent } from '../db/repositories/notes.repository';
import { parsePendingTasks } from '../db/repositories/search.repository';
import type { Folder, FolderInsert, NoteMetadata, Tag } from '../db/schema';
import { DAILY_NOTES_FOLDER_ID, FolderService, TRASH_FOLDER_ID } from '../services/folders.service';
import { NoteService } from '../services/notes.service';
import { SearchService } from '../services/search.service';
import { TagService } from '../services/tags.service';
import { SyncScheduler } from '../sync/sync-scheduler';
import { generatePreview, generateTitle } from '../utils/notes';
import { SortType, sortFolders, sortNotes } from '../utils/sorts';
import { createStorageAdapter } from './config';
import { useUserStore } from './user.store';

// small lru cache for notes
class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private limit: number;

    constructor(limit: number) {
        this.limit = limit;
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;
        const val = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, val);
        return val;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                // console.log("Evicting key from cache due to limit", firstKey);
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

// In-memory note content cache to bypass SQLCipher/SQLite overhead for reads
const noteContentCache = new LRUCache<string, string>(25);


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
    tasks: PendingTaskNote[];
    rootSettings: RootSettings;
    isInitialized: boolean;

    bulkDeleteNotes: (noteIds: string[]) => Promise<void>;
    bulkMoveNotes: (noteIds: string[], targetFolderId: string | null) => Promise<void>;

    // Initialization
    initApp: () => Promise<void>;

    // Note operations
    createNote: (data: Partial<NoteMetadata>) => Promise<{ data: NoteMetadata | null, error: string | null }>;
    createNotesBulk: (notes: { title: string, content: string }[]) => Promise<{ data: NoteMetadata[], folder: Folder | null, error: string | null }>;
    updateNoteMetadata: (noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>) => Promise<void>;
    deleteNote: (noteId: string) => Promise<void>;
    permanentlyDeleteNote: (noteId: string) => Promise<void>;
    restoreNote: (noteId: string, targetFolderId?: string | null) => Promise<NoteMetadata | null>;
    getNoteById: (noteId: string) => NoteMetadata | undefined;
    getForwardLinks: (noteId: string) => Promise<(NoteMetadata & { blockId: string | null })[]>;
    getBacklinks: (noteId: string) => Promise<(NoteMetadata & { blockId: string | null })[]>;

    // Tag operations
    addTagToNote: (noteId: string, tag: { id?: string, name: string, color?: string }) => Promise<{ error: string | null }>;
    removeTagFromNote: (noteId: string, tagId: string) => Promise<void>;
    updateTag: (tagId: string, updates: Partial<Omit<Tag, 'id'>>) => Promise<void>;
    createTag: (data: { name: string, color?: string }) => Promise<{ data: Tag | null, error: string | null }>;
    deleteTag: (tagId: string) => Promise<void>;

    // Content operations (lazy loaded)
    getNoteContent: (noteId: string) => Promise<string>;
    updateNoteContent: (noteId: string, content: string) => Promise<{ error: string | null }>;
    toggleTask: (noteId: string, taskIndex: number) => Promise<void>;
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
    tasks: [],
    rootSettings: { sortType: 'UPDATED_LAST' },
    isInitialized: false,

    bulkDeleteNotes: async (noteIds) => {
        await NoteService.bulkSoftDelete(noteIds);
        set(state => {
            const now = new Date();
            return {
                notes: state.notes.map(n =>
                    noteIds.includes(n.id)
                        ? { ...n, isDeleted: true, folderId: 'system-trash', originalFolderId: n.folderId, deletedAt: now, updatedAt: now }
                        : n
                )
            };
        });
        SyncScheduler.instance?.notifyContentChange();
    },

    bulkMoveNotes: async (noteIds, targetFolderId) => {
        const normalizedFolderId = (targetFolderId === 'root' || targetFolderId === '') ? null : targetFolderId;
        await NoteService.bulkMove(noteIds, normalizedFolderId);
        set(state => ({
            notes: state.notes.map(n =>
                noteIds.includes(n.id) ? { ...n, folderId: normalizedFolderId, updatedAt: new Date() } : n
            )
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    // Initialize App - Load ALL data on startup
    initApp: async () => {
        const wasInitialized = get().isInitialized;

        // Only purge the content cache on a cold start.
        // On a sync-triggered reinit the cache reflects the last *saved* content;
        // clearing it would force DB re-reads and could race with an active editor debounce.
        if (!wasInitialized) {
            noteContentCache.clear();
        }

        // 1. Run Maintenance FIRST, only on cold starts
        if (!wasInitialized) {
            try {
                await purgeGuestTombstones();
            } catch (err) {
                console.warn('[Store] Startup maintenance failed, continuing init...', err);
            }

            try {
                await NoteService.healRootFolderIds();
            } catch (err) {
                console.warn('[Store] Startup self-healing failed:', err);
            }

            // Load root settings from storage
            try {
                const storage = createStorageAdapter();
                const savedSortType = await storage.getItem('root-folder-sort-type');
                if (savedSortType) {
                    set({ rootSettings: { sortType: savedSortType as SortType } });
                }
            } catch (err) {
                console.warn('[Store] Failed to load root settings:', err);
            }
        }

        // 2. Now it is completely safe to open read cursors
        const allFolders = await FolderService.getFoldersInFolder(null, true);
        const trashFolders = await FolderService.getFoldersInFolder(TRASH_FOLDER_ID, true);
        const allNotes = await NoteService.getNotesInFolder(null, true);
        const allTags = await TagService.getAllTags();

        // Recursively load all folders
        const loadAllFolders = async (): Promise<Folder[]> => {
            const result: Folder[] = [];
            const queue = [...allFolders, ...trashFolders];

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

        const tasks = await SearchService.findNotesWithPendingTasks();

        if (!wasInitialized) {
            // Cold start: replace everything directly.
            set({ folders, notes, tags: allTags, tasks, isInitialized: true });
            console.log(`[Store] Initialized with ${folders.length} folders and ${notes.length} notes.`);
        } else {
            // Sync-triggered reinit: merge notes so that any in-memory note whose
            // updatedAt is newer than the DB version is kept as-is.  This prevents
            // a hard-max sync flush from clobbering optimistic state (title, preview,
            // isDirty) that the editor debounce has written to the store but not yet
            // persisted to SQLite.
            set(state => {
                const inMemoryByIdMap = new Map(state.notes.map(n => [n.id, n]));
                const mergedNotes = notes.map(dbNote => {
                    const inMemory = inMemoryByIdMap.get(dbNote.id);
                    if (!inMemory) return dbNote;
                    const dbTs = dbNote.updatedAt ? new Date(dbNote.updatedAt).getTime() : 0;
                    const memTs = inMemory.updatedAt ? new Date(inMemory.updatedAt).getTime() : 0;
                    if (memTs > dbTs) {
                        // Local edit in-flight: keep in-memory metadata and its cached content
                        return inMemory;
                    }
                    // DB is newer (remote sync update): evict the stale content cache entry
                    // so the next editor open re-reads the updated content from the DB.
                    noteContentCache.delete(dbNote.id);
                    return dbNote;
                });
                return { folders, notes: mergedNotes, tags: allTags, tasks, isInitialized: true };
            });
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

    createNotesBulk: async (notes: { title: string, content: string }[]) => {
        try {
            const userState = useUserStore.getState();
            const { notes: newNotes, folder: newFolder } = await NoteService.createBulk(notes, userState.role, userState.sub_exp_date);

            if (newNotes.length > 0 || newFolder) {
                set(state => {
                    const existingIds = new Set(state.notes.map(n => n.id));
                    const filteredNewNotes = newNotes.filter(n => !existingIds.has(n.id));

                    const existingFolderIds = new Set(state.folders.map(f => f.id));
                    const updatedFolders = newFolder && !existingFolderIds.has(newFolder.id)
                        ? [...state.folders, newFolder]
                        : state.folders;

                    return {
                        notes: [...state.notes, ...filteredNewNotes],
                        folders: updatedFolders
                    };
                });
                SyncScheduler.instance?.notifyContentChange();
            }

            return { data: newNotes, folder: newFolder, error: null };
        } catch (error) {
            console.error('[Store] Failed to create notes in bulk:', error);
            return { data: [], folder: null, error: error instanceof Error ? error.message : String(error) };
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

        // 2. Invalidate cache
        noteContentCache.delete(noteId);

        // 3. Manual State Mutation
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

        // Invalidate cache
        noteContentCache.delete(noteId);

        set(state => ({
            notes: state.notes.filter(n => n.id !== noteId)
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    restoreNote: async (noteId, targetFolderId) => {
        const normalizedFolderId = (targetFolderId === 'root' || targetFolderId === '') ? null : targetFolderId;
        await NoteService.restore(noteId, normalizedFolderId);

        // Fetch the updated note to get the correct restored state
        const restoredNote = await NoteService.getNoteById(noteId);

        if (restoredNote) {
            set(state => ({
                notes: state.notes.map(n => n.id === noteId ? restoredNote : n)
            }));
        }
        SyncScheduler.instance?.notifyContentChange();
        return restoredNote;
    },

    getNoteById: (noteId) => {
        return get().notes.find(n => n.id === noteId);
    },

    getForwardLinks: async (noteId) => {
        return await NoteService.getForwardLinks(noteId);
    },

    getBacklinks: async (noteId) => {
        return await NoteService.getBacklinks(noteId);
    },

    // ============ TAG OPERATIONS ============

    addTagToNote: async (noteId, tag) => {
        try {
            const color = tag.color ?? COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].value;
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

    createTag: async (data: { name: string, color?: string }) => {
        try {
            const color = data.color ?? COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].value;
            const userState = useUserStore.getState();
            const newTag = await TagService.create({
                name: data.name,
                color,
                createdAt: new Date(),
                updatedAt: new Date(),
            }, userState.role, userState.sub_exp_date);

            set(state => ({
                tags: [...state.tags, newTag]
            }));

            SyncScheduler.instance?.notifyContentChange();
            return { data: newTag, error: null };
        } catch (error) {
            console.error('[Store] Failed to create tag:', error);
            return { data: null, error: error instanceof Error ? error.message : String(error) };
        }
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

    getNoteContent: async (noteId) => {
        const cached = noteContentCache.get(noteId);
        if (cached !== undefined) {
            return cached;
        }
        // Content is heavy, still lazy loaded from DB
        const content = await NoteService.getNoteContent(noteId);
        noteContentCache.set(noteId, content);
        return content;
    },

    updateNoteContent: async (noteId, content) => {
        try {
            const note = get().notes.find(n => n.id === noteId);
            if (!note) return { error: 'Note not found' };

            const isDailyNote = note.folderId === 'system-daily-notes';
            const hadTasks = get().tasks.some(t => t.noteId === noteId);
            const hasTasks = parsePendingTasks(content).length > 0;
            const skipTasksUpdate = !hadTasks && !hasTasks;

            const normalized = normalizeStoredContent(content);
            const preview = isDailyNote ? generateTitle(normalized) : generatePreview(normalized);
            const title = isDailyNote ? note.title : generateTitle(normalized);
            const now = new Date();

            await NoteService.updateContent(noteId, content, skipTasksUpdate, isDailyNote, now);

            // Cache the newly saved normalized content
            noteContentCache.set(noteId, normalized);

            let tasks = get().tasks;
            if (!skipTasksUpdate) {
                tasks = await SearchService.findNotesWithPendingTasks();
            }

            set(state => ({
                notes: state.notes.map(n =>
                    n.id === noteId
                        ? { ...n, preview, title, isDirty: true, updatedAt: now }
                        : n
                ),
                tasks
            }));

            SyncScheduler.instance?.notifyContentChange();
            return { error: null };
        } catch (error) {
            console.error('[Store] Failed to update note content:', error);
            const message = error instanceof Error ? error.message : String(error);
            getPlatformAdapters().toast.show({
                type: 'error',
                title: 'Note update failed',
                message
            });
            return { error: message };
        }
    },

    toggleTask: async (noteId, taskIndex) => {
        try {
            await NoteService.toggleTask(noteId, taskIndex);

            // Invalidate cache since database content has changed
            noteContentCache.delete(noteId);

            // Fetch updated metadata (with new preview)
            const updatedNote = await NoteService.getNoteById(noteId);

            // Refresh tasks in store
            const tasks = await SearchService.findNotesWithPendingTasks();

            if (updatedNote) {
                set(state => ({
                    notes: state.notes.map(n => n.id === noteId ? updatedNote : n),
                    tasks
                }));
            } else {
                set({ tasks });
            }
            SyncScheduler.instance?.notifyContentChange();
        } catch (error) {
            console.error('[Store] Failed to toggle task:', error);
            const message = error instanceof Error ? error.message : String(error);
            getPlatformAdapters().toast.show({
                type: 'error',
                title: 'Task update failed',
                message
            });
        }
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
        const normalizedFolderId = (folderId === 'root' || folderId === '') ? null : folderId;
        if (normalizedFolderId === null) {
            set({ rootSettings: { sortType } });
            // Persist root sort type
            try {
                const storage = createStorageAdapter();
                storage.setItem('root-folder-sort-type', sortType);
            } catch (err) {
                console.warn('[Store] Failed to save root sort type:', err);
            }
        } else {
            get().updateFolder(normalizedFolderId, { sortType });
        }
        SyncScheduler.instance?.notifyContentChange();
    },

    getSortType: (folderId) => {
        const normalizedFolderId = (folderId === 'root' || folderId === '') ? null : folderId;
        if (normalizedFolderId === null) {
            return get().rootSettings.sortType;
        }
        const folder = get().getFolderById(normalizedFolderId);
        return (folder?.sortType as SortType) ?? 'UPDATED_LAST';
    },

    getNotesInFolder: (folderId, includeDeleted = false) => {
        const normalizedFolderId = (folderId === 'root' || folderId === '') ? null : folderId;
        const { notes, folders } = get();
        const sortType = get().getSortType(normalizedFolderId);

        // Helper to safely compare Date objects, strings, or numbers
        const getTs = (d: any) => d ? new Date(d).getTime() : 0;

        const filtered = notes.filter((note) => {
            // 1. Browsing the Trash Root
            if (normalizedFolderId === TRASH_FOLDER_ID) {
                if (!note.isDeleted) return false;

                // Show if originally at the root
                const origFolderId = (note.originalFolderId === 'root' || note.originalFolderId === '') ? null : note.originalFolderId;
                if (!origFolderId) return true;

                const origFolder = folders.find(f => f.id === origFolderId);

                // Show if original folder is hard-deleted or still active
                if (!origFolder || !origFolder.isDeleted) return true;

                // 🚨 NEW: Timestamp Comparison
                // If note was deleted strictly BEFORE the folder, it's an independent deletion.
                const noteDeletedTs = getTs(note.deletedAt);
                const folderDeletedTs = getTs(origFolder.deletedAt);
                return noteDeletedTs < folderDeletedTs;
            }

            // 2. Virtual Folder Override: DAILY NOTES
            if (normalizedFolderId === DAILY_NOTES_FOLDER_ID) {
                const noteFolderId = (note.folderId === 'root' || note.folderId === '') ? null : note.folderId;
                return noteFolderId === DAILY_NOTES_FOLDER_ID && (includeDeleted ? true : !note.isDeleted);
            }

            // 3. Browsing INSIDE a deleted folder
            if (note.isDeleted) {
                if (!includeDeleted) return false;
                const noteOriginalFolderId = (note.originalFolderId === 'root' || note.originalFolderId === '') ? null : note.originalFolderId;
                if (noteOriginalFolderId !== normalizedFolderId) return false;

                // 🚨 NEW: Hide independent deletions from inside the reconstructed folder
                const origFolder = folders.find(f => f.id === normalizedFolderId);
                if (origFolder && origFolder.isDeleted) {
                    const noteDeletedTs = getTs(note.deletedAt);
                    const folderDeletedTs = getTs(origFolder.deletedAt);

                    // If note was deleted before the folder, it doesn't belong here anymore
                    if (noteDeletedTs < folderDeletedTs) return false;
                }

                return true;
            }

            // 4. Standard active notes
            const noteFolderId = (note.folderId === 'root' || note.folderId === '') ? null : note.folderId;
            const folderMatch = noteFolderId === normalizedFolderId;
            const deletedMatch = includeDeleted ? true : !note.isDeleted;
            return folderMatch && deletedMatch;
        });

        return sortNotes(filtered, sortType);
    },

    getFoldersInFolder: (parentId, includeDeleted = false) => {
        const normalizedParentId = (parentId === 'root' || parentId === '') ? null : parentId;
        const { folders } = get();
        const sortType = get().getSortType(normalizedParentId);

        const getTs = (d: any) => d ? new Date(d).getTime() : 0;

        const filtered = folders.filter((folder) => {
            // 1. Browsing the Trash Root
            if (normalizedParentId === TRASH_FOLDER_ID) {
                if (!folder.isDeleted) return false;
                const origParentId = (folder.originalParentId === 'root' || folder.originalParentId === '') ? null : folder.originalParentId;
                if (!origParentId) return true;

                const origParent = folders.find(f => f.id === origParentId);
                if (!origParent || !origParent.isDeleted) return true;

                // Timestamp check for nested folders
                const folderDeletedTs = getTs(folder.deletedAt);
                const parentDeletedTs = getTs(origParent.deletedAt);
                return folderDeletedTs < parentDeletedTs;
            }

            // 2. Browsing INSIDE a deleted folder
            if (folder.isDeleted) {
                if (!includeDeleted) return false;
                const folderOriginalParentId = (folder.originalParentId === 'root' || folder.originalParentId === '') ? null : folder.originalParentId;
                if (folderOriginalParentId !== normalizedParentId) return false;

                const origParent = folders.find(f => f.id === normalizedParentId);
                if (origParent && origParent.isDeleted) {
                    const folderDeletedTs = getTs(folder.deletedAt);
                    const parentDeletedTs = getTs(origParent.deletedAt);
                    if (folderDeletedTs < parentDeletedTs) return false;
                }

                return true;
            }

            // 3. Standard active folders
            const folderParentId = (folder.parentId === 'root' || folder.parentId === '') ? null : folder.parentId;
            const parentMatch = folderParentId === normalizedParentId;
            const deletedMatch = includeDeleted ? true : !folder.isDeleted;
            return parentMatch && deletedMatch;
        });

        return sortFolders(filtered, sortType || 'UPDATED_LAST');
    },

    reset: () => {
        noteContentCache.clear();
        set({
            notes: [],
            folders: [],
            tags: [],
            tasks: [],
            rootSettings: { sortType: 'UPDATED_LAST' },
            isInitialized: false,
        });
    },
}));
