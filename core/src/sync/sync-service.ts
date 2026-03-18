import { inArray } from 'drizzle-orm';
import { authApi } from '../api/auth.api';
import { storageApi } from '../api/storage.api';
import { syncApi } from '../api/sync.api';
import { clearDirtyFolders, getDirtyFolders, upsertSyncedFolder, } from '../db/repositories/folders.repository';
import { getImagesByIds } from '../db/repositories/images.repository';
import { clearDirtyNotes, getDirtyNotes, getNoteContent, upsertSyncedNote, } from '../db/repositories/notes.repository';
import { clearDirtyTags, getDirtyTags, upsertSyncedTag, } from '../db/repositories/tags.repository';
import { clearDirtyTasks, getDirtyTasks, upsertSyncedTask, } from '../db/repositories/tasks.repository';
import * as schema from '../db/schema';
import { imageSyncService } from '../services/images/image-sync.service';
import { StorageService } from '../services/storage.service';
import { createStorageAdapter } from '../stores/config';
import { getDb } from '../stores/db.store';
import { useSyncStore } from '../stores/sync.store';
import { decryptPayload, deriveAesKey, encryptPayload } from '../utils/crypto';

const getSyncTimeKey = (userId: string) => `${userId}_last_sync_time`;

// Placeholders removed

export async function resetSyncPointer(userId: string) {
    const storage = createStorageAdapter();
    await storage.removeItem(getSyncTimeKey(userId));
    console.log(`[Sync] Reset sync pointer for user ${userId}`);
}

/**
 * Internal push implementation.
 * @internal Use syncPush instead.
 */
export async function performSyncPush(masterKey: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const db = getDb();
    const userId = session.user.id;
    const now = new Date();
    let didDeleteTombstones = false;

    // 1. Get/Derive the AES key
    const { aesKey, activeMnemonic, setAesKey } = useSyncStore.getState();
    const currentKey = (aesKey && activeMnemonic === masterKey)
        ? aesKey
        : Buffer.from(deriveAesKey(masterKey));

    // 2. Update the store if we derived a new one
    if (activeMnemonic !== masterKey) {
        setAesKey(masterKey, currentKey);
    }

    const pushFolders = async () => {
        const dirtyFolders = await getDirtyFolders();
        if (dirtyFolders.length === 0) return;

        const payloadFolders = await Promise.all(dirtyFolders.map(async (folder) => {
            const isTombstone = folder.isPermDeleted;
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(folder), currentKey);
            return {
                id: folder.id,
                user_id: userId,
                updated_at: now.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        }));

        const { error } = await syncApi.upsertFolders(payloadFolders);
        if (error) throw error;

        const tombstones = dirtyFolders.filter((f: any) => f.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map((f: any) => f.id);
            await db.delete(schema.folders).where(inArray(schema.folders.id, tombstoneIds));
            didDeleteTombstones = true;
        }

        const aliveFolders = dirtyFolders.filter((f: any) => !f.isPermDeleted);
        if (aliveFolders.length > 0) {
            await clearDirtyFolders(aliveFolders.map((f: any) => f.id));
        }
    };

    const pushTags = async () => {
        const dirtyTags = await getDirtyTags();
        if (dirtyTags.length === 0) return;

        const payloadTags = await Promise.all(dirtyTags.map(async (tag) => {
            const isTombstone = tag.isPermDeleted;
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(tag), currentKey);
            return {
                id: tag.id,
                user_id: userId,
                updated_at: now.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        }));

        const { error } = await syncApi.upsertTags(payloadTags);
        if (error) throw error;

        const tombstones = dirtyTags.filter((t: any) => t.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map((t: any) => t.id);
            await db.delete(schema.tags).where(inArray(schema.tags.id, tombstoneIds));
            didDeleteTombstones = true;
        }

        const aliveTags = dirtyTags.filter((t: any) => !t.isPermDeleted);
        if (aliveTags.length > 0) {
            await clearDirtyTags(aliveTags.map((t: any) => t.id));
        }
    };

    const pushTasks = async () => {
        const dirtyTasks = await getDirtyTasks();
        if (dirtyTasks.length === 0) return;

        const payloadTasks = await Promise.all(dirtyTasks.map(async (task) => {
            const isTombstone = task.isPermDeleted;
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(task), currentKey);
            return {
                id: task.id,
                user_id: userId,
                updated_at: now.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        }));

        const { error } = await syncApi.upsertTasks(payloadTasks);
        if (error) throw error;

        const tombstones = dirtyTasks.filter((t: any) => t.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map((t: any) => t.id);
            await db.delete(schema.tasks).where(inArray(schema.tasks.id, tombstoneIds));
            didDeleteTombstones = true;
        }

        const aliveTasks = dirtyTasks.filter((t: any) => !t.isPermDeleted);
        if (aliveTasks.length > 0) {
            await clearDirtyTasks(aliveTasks.map((t: any) => t.id));
        }
    };

    let pushedNoteIds: string[] = [];
    const pushNotes = async () => {
        const dirtyNotes = await getDirtyNotes();
        if (dirtyNotes.length === 0) return;

        pushedNoteIds = dirtyNotes.map((n: any) => n.id);

        const payloadNotes = await Promise.all(dirtyNotes.map(async (metadata: any) => {
            const isTombstone = metadata.isPermDeleted;
            const content = await getNoteContent(metadata.id);
            const dataToEncrypt = { ...metadata, content };

            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(dataToEncrypt), currentKey);
            return {
                id: metadata.id,
                user_id: userId,
                updated_at: now.toISOString(),
                created_at: metadata.createdAt.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        }));

        const { error } = await syncApi.upsertNotes(payloadNotes);
        if (error) throw error;

        const tombstones = dirtyNotes.filter((n: any) => n.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map((n: any) => n.id);
            await db.transaction(async (tx: any) => {
                await tx.delete(schema.noteContent).where(inArray(schema.noteContent.id, tombstoneIds));
                await tx.delete(schema.noteVersions).where(inArray(schema.noteVersions.noteId, tombstoneIds));
                await tx.delete(schema.noteMetadata).where(inArray(schema.noteMetadata.id, tombstoneIds));
            });
            didDeleteTombstones = true;
        }

        const aliveNotes = dirtyNotes.filter((n: any) => !n.isPermDeleted);
        if (aliveNotes.length > 0) {
            await clearDirtyNotes(aliveNotes.map((n: any) => n.id));
        }
    };

    await pushFolders();
    await pushTags();
    await pushTasks();
    await pushNotes();

    if (pushedNoteIds.length > 0) {
        await imageSyncService.pushImages(masterKey, userId, pushedNoteIds);
    }

    if (didDeleteTombstones) {
        console.log('[Sync] Tombstones deleted locally. Running garbage collection...');
        await new Promise(resolve => setTimeout(resolve, 50));
        await StorageService.runGarbageCollection(true);
    }
}

/**
 * Internal pull implementation.
 * @internal Use syncPull instead.
 */
export async function performSyncPull(masterKey: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const db = getDb();
    const userId = session.user.id;
    const { lastSyncAt } = useSyncStore.getState();
    const lastSyncTime = lastSyncAt ?? new Date('2000-01-01T00:00:00Z');

    let didDeleteTombstones = false;

    // 1. Get/Derive the AES key
    const { aesKey, activeMnemonic, setAesKey } = useSyncStore.getState();
    const currentKey = (aesKey && activeMnemonic === masterKey)
        ? aesKey
        : Buffer.from(deriveAesKey(masterKey));

    // 2. Update the store if we derived a new one
    if (activeMnemonic !== masterKey) {
        setAesKey(masterKey, currentKey);
    }

    console.log(`[Sync] Pulling changes after: ${lastSyncTime.toISOString()}`);
    const { data, error } = await syncApi.pullSyncData(lastSyncTime.toISOString());

    if (error) throw error;

    const cloudFolders = data.folders || [];
    const cloudTags = data.tags || [];
    const cloudTasks = data.tasks || [];
    const cloudNotes = data.notes || [];

    // Pull Folders
    if (cloudFolders.length > 0) {
        for (let i = 0; i < cloudFolders.length; i += 15) {
            const chunk = cloudFolders.slice(i, i + 15);
            const deletedIds: string[] = [];
            const parsedFolders: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        deletedIds.push(row.id);
                        continue;
                    }
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, currentKey);
                    const folderData = JSON.parse(decryptedJson);
                    folderData.createdAt = new Date(folderData.createdAt);
                    folderData.updatedAt = new Date(folderData.updatedAt);
                    folderData.deletedAt = folderData.deletedAt ? new Date(folderData.deletedAt) : null;
                    folderData.isDirty = false;
                    parsedFolders.push(folderData);
                } catch (e) {
                    console.error("Failed to decrypt folder", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) await tx.delete(schema.folders).where(inArray(schema.folders.id, deletedIds));
                for (const f of parsedFolders) await upsertSyncedFolder(f, tx);
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Pull Tasks
    if (cloudTasks.length > 0) {
        for (let i = 0; i < cloudTasks.length; i += 15) {
            const chunk = cloudTasks.slice(i, i + 15);
            const deletedIds: string[] = [];
            const parsedTasks: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        deletedIds.push(row.id);
                        continue;
                    }
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, currentKey);
                    const taskData = JSON.parse(decryptedJson);
                    taskData.createdAt = new Date(taskData.createdAt);
                    taskData.updatedAt = new Date(taskData.updatedAt);
                    taskData.deadline = new Date(taskData.deadline);
                    taskData.completedAt = taskData.completedAt ? new Date(taskData.completedAt) : null;
                    taskData.isDirty = false;
                    parsedTasks.push(taskData);
                } catch (e) {
                    console.error("Failed to decrypt task", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) await tx.delete(schema.tasks).where(inArray(schema.tasks.id, deletedIds));
                for (const t of parsedTasks) await upsertSyncedTask(t, tx);
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Pull Tags
    if (cloudTags.length > 0) {
        for (let i = 0; i < cloudTags.length; i += 15) {
            const chunk = cloudTags.slice(i, i + 15);
            const deletedIds: string[] = [];
            const parsedTags: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        deletedIds.push(row.id);
                        continue;
                    }
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, currentKey);
                    const tagData = JSON.parse(decryptedJson);
                    tagData.createdAt = new Date(tagData.createdAt);
                    tagData.updatedAt = new Date(tagData.updatedAt);
                    tagData.deletedAt = tagData.deletedAt ? new Date(tagData.deletedAt) : null;
                    tagData.isDirty = false;
                    parsedTags.push(tagData);
                } catch (e) {
                    console.error("Failed to decrypt tag", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) await tx.delete(schema.tags).where(inArray(schema.tags.id, deletedIds));
                for (const t of parsedTags) await upsertSyncedTag(t, tx);
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Pull Notes
    let fetchedNoteIds: string[] = [];
    if (cloudNotes.length > 0) {
        for (let i = 0; i < cloudNotes.length; i += 15) {
            const chunk = cloudNotes.slice(i, i + 15);
            const deletedIds: string[] = [];
            const parsedNotes: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        deletedIds.push(row.id);
                        continue;
                    }
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, currentKey);
                    const noteFullData = JSON.parse(decryptedJson);
                    noteFullData.createdAt = new Date(noteFullData.createdAt);
                    noteFullData.updatedAt = new Date(noteFullData.updatedAt);
                    noteFullData.deletedAt = noteFullData.deletedAt ? new Date(noteFullData.deletedAt) : null;
                    noteFullData.isDirty = false;
                    fetchedNoteIds.push(noteFullData.id);
                    parsedNotes.push(noteFullData);
                } catch (e) {
                    console.error("Failed to decrypt note", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) {
                    await tx.delete(schema.noteMetadata).where(inArray(schema.noteMetadata.id, deletedIds));
                    await tx.delete(schema.noteContent).where(inArray(schema.noteContent.id, deletedIds));
                    await tx.delete(schema.noteVersions).where(inArray(schema.noteVersions.noteId, deletedIds));
                }
                for (const n of parsedNotes) await upsertSyncedNote(n, tx);
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Sync time is now persisted by setLastSyncAt (called by the syncPull wrapper)

    if (didDeleteTombstones) {
        await new Promise(resolve => setTimeout(resolve, 50));
        await StorageService.runGarbageCollection(true);
    }

    // Background Image Pull
    const { data: cloudLinks, error: linkError } = await storageApi.getUserImageLinks(userId, fetchedNoteIds);
    if (!linkError && cloudLinks && cloudLinks.length > 0) {
        const uniqueImageIds = Array.from(new Set(cloudLinks.map(l => l.image_id as string)));
        const localImages = await getImagesByIds(uniqueImageIds);
        const localImageIds = new Set(localImages.map((i: any) => i.id));
        const missingIds = uniqueImageIds.filter(id => !localImageIds.has(id));

        if (missingIds.length > 0) {
            const { data: cloudMeta, error: metaError } = await storageApi.getEncryptedImagesMetadata(userId, missingIds);
            if (!metaError && cloudMeta) {
                const downloadQueue = cloudMeta.map(meta => ({
                    imageId: meta.id,
                    noteId: '',
                    nonce: meta.nonce,
                    masterKey,
                    userId
                }));
                imageSyncService.queueImagesForDownload(downloadQueue);
            }
        }
    }
}

/**
 * Public wrapper that handles isSyncing lock and offline checks.
 * This is the ONLY method that should be called by components/schedulers.
 */
export async function syncPush(masterKey: string): Promise<boolean> {
    const store = useSyncStore.getState();
    if (!store.isOnline) return false;

    if (store.isSyncing) {
        console.log('[syncPush] Skipped — already in-flight');
        return false;
    }

    store.setSyncing(true);
    try {
        await performSyncPush(masterKey);
        store.setLastSyncAt(new Date());
        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        store.setSyncError(msg);
        throw err;
    } finally {
        store.setSyncing(false);
    }
}

/**
 * Public wrapper that handles isSyncing lock and offline checks.
 * This is the ONLY method that should be called by components/schedulers.
 */
export async function syncPull(masterKey: string): Promise<boolean> {
    const store = useSyncStore.getState();
    if (!store.isOnline) return false;

    if (store.isSyncing) {
        console.log('[syncPull] Skipped — already in-flight');
        return false;
    }

    store.setSyncing(true);
    try {
        await performSyncPull(masterKey);
        store.setLastSyncAt(new Date());
        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        store.setSyncError(msg);
        throw err;
    } finally {
        store.setSyncing(false);
    }
}
