import { inArray } from 'drizzle-orm';
import { authApi } from '../api/auth.api';
import { storageApi } from '../api/storage.api';
import { syncApi } from '../api/sync.api';
import {
    clearDirtyFolders,
    getDirtyFolders,
    upsertSyncedFolder,
} from '../db/repositories/folders.repository';
import { getImagesByIds } from '../db/repositories/images.repository';
import {
    clearDirtyNotes,
    getDirtyNotes,
    getNoteContent,
    upsertSyncedNote,
} from '../db/repositories/notes.repository';
import {
    clearDirtyTasks,
    getDirtyTasks,
    upsertSyncedTask,
} from '../db/repositories/tasks.repository';
import * as schema from '../db/schema';
import { StorageService } from '../services/storage.service';
import { imageSyncService } from '../services/sync/image-sync.service';
import { createStorageAdapter } from '../stores/config';
import { getDb } from '../stores/db.store';
import { decryptPayload, encryptPayload } from '../utils/crypto';

const getSyncTimeKey = (userId: string) => `${userId}_last_sync_time`;
const storage = createStorageAdapter();

// Placeholders removed

export async function resetSyncPointer(userId: string) {
    await storage.removeItem(getSyncTimeKey(userId));
    console.log(`[Sync] Reset sync pointer for user ${userId}`);
}

export async function syncPush(masterKey: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const db = getDb();
    const userId = session.user.id;
    const now = new Date(); // To standardize the timestamp of this push
    let didDeleteTombstones = false;

    // === 1. FOLDERS ISOLATED PUSH ===
    const pushFolders = async () => {
        const dirtyFolders = await getDirtyFolders();
        if (dirtyFolders.length === 0) return;

        const payloadFolders = await Promise.all(dirtyFolders.map(async (folder) => {
            const isTombstone = folder.isPermDeleted;
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(folder), masterKey);
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
        if (error) {
            console.error(`Push folders error: ${error.message}`);
            return;
        }

        const tombstones = dirtyFolders.filter((f: any) => f.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map((f: any) => f.id);
            await db.delete(schema.folders).where(inArray(schema.folders.id, tombstoneIds));
            didDeleteTombstones = true;
        }

        const aliveFolders = dirtyFolders.filter((f: any) => !f.isPermDeleted);
        if (aliveFolders.length > 0) {
            await clearDirtyFolders(aliveFolders.map((f: any) => f.id), now);
        }
    };

    // === 2. TASKS ISOLATED PUSH ===
    const pushTasks = async () => {
        const dirtyTasks = await getDirtyTasks();
        if (dirtyTasks.length === 0) return;

        const payloadTasks = await Promise.all(dirtyTasks.map(async (task) => {
            const isTombstone = task.isPermDeleted;
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(task), masterKey);
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
        if (error) {
            console.error(`Push tasks error: ${error.message}`);
            return;
        }

        const tombstones = dirtyTasks.filter((t: any) => t.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map((t: any) => t.id);
            await db.delete(schema.tasks).where(inArray(schema.tasks.id, tombstoneIds));
            didDeleteTombstones = true;
        }

        const aliveTasks = dirtyTasks.filter((t: any) => !t.isPermDeleted);
        if (aliveTasks.length > 0) {
            await clearDirtyTasks(aliveTasks.map((t: any) => t.id), now);
        }
    };

    // === 3. NOTES ISOLATED PUSH ===
    let pushedNoteIds: string[] = []; // Used for pushing images later
    const pushNotes = async () => {
        const dirtyNotes = await getDirtyNotes();
        if (dirtyNotes.length === 0) return;

        pushedNoteIds = dirtyNotes.map((n: any) => n.id);

        const payloadNotes = await Promise.all(dirtyNotes.map(async (metadata: any) => {
            const isTombstone = metadata.isPermDeleted;

            // Fetch content
            const content = await getNoteContent(metadata.id);
            const dataToEncrypt = { ...metadata, content }; // Combine metadata & heavy content for cloud storage

            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(dataToEncrypt), masterKey);
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
        if (error) {
            console.error(`Push notes error: ${error.message}`);
            return;
        }

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
            await clearDirtyNotes(aliveNotes.map((n: any) => n.id), now);
        }
    };

    // === FIRE ALL CONCURRENTLY ===
    await Promise.allSettled([
        pushFolders(),
        pushTasks(),
        pushNotes()
    ]);

    // === 4. IMAGES ===
    // We push images AFTER notes to avoid foreign key constraints in `note_images` where `note_id` might not exist in `encrypted_notes` yet.
    if (pushedNoteIds.length > 0) {
        await imageSyncService.pushImages(
            masterKey,
            userId,
            pushedNoteIds
        );
    }

    // Note: We don't update SyncTime here because Push doesn't necessarily mean we want to skip Pulling things that happened *during* our offline state. 

    if (didDeleteTombstones) {
        console.log('[Sync] Tombstones deleted locally. Running garbage collection to free space...');
        await StorageService.runGarbageCollection(true);
    }
}


export async function syncPull(masterKey: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const db = getDb();
    const userId = session.user.id;
    const lastSyncStr = await storage.getItem(getSyncTimeKey(userId));
    let lastSyncTime = new Date('2000-01-01T00:00:00Z'); // Safe past date fallback

    if (lastSyncStr) {
        try {
            // AsyncStorage might return a literal "undefined", "null", or just an invalid format
            if (typeof lastSyncStr === 'string' && lastSyncStr !== 'undefined' && lastSyncStr !== 'null') {
                const parsed = new Date(lastSyncStr);
                if (!isNaN(parsed.getTime())) {
                    lastSyncTime = parsed;
                }
            } else if ((lastSyncStr as any) instanceof Date) {
                // In case the storage adapter dynamically casted it
                if (!isNaN((lastSyncStr as any).getTime())) {
                    lastSyncTime = (lastSyncStr as any);
                }
            }
        } catch (e) {
            console.error('[Sync] Failed to parse last sync time', e);
        }
    }

    const newSyncTime = new Date().toISOString(); // Time right before we fetch
    let didDeleteTombstones = false;

    console.log(`[Sync] Pulling changes modified after: ${lastSyncTime.toISOString()}`);

    const { data, error } = await syncApi.pullSyncData(lastSyncTime.toISOString());

    if (error) {
        console.error("Sync pull failed:", error);
        throw error;
    }

    const cloudFolders = data.folders;
    const cloudTasks = data.tasks;
    const cloudNotes = data.notes;

    // === 1. PULL FOLDERS ===

    if (cloudFolders && cloudFolders.length > 0) {
        console.log(`[Sync] Received ${cloudFolders.length} updated folders from cloud.`);
        const chunkSize = 15;
        for (let i = 0; i < cloudFolders.length; i += chunkSize) {
            const chunk = cloudFolders.slice(i, i + chunkSize);
            const deletedIds: string[] = [];
            const parsedFolders: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        deletedIds.push(row.id);
                        continue;
                    }

                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, masterKey);
                    const folderData = JSON.parse(decryptedJson);

                    // Convert timestamps back to Date objects
                    folderData.createdAt = new Date(folderData.createdAt);
                    folderData.updatedAt = new Date(folderData.updatedAt);
                    folderData.deletedAt = folderData.deletedAt ? new Date(folderData.deletedAt) : null;
                    folderData.isDirty = false; // We just grabbed it, it's clean
                    folderData.lastSyncedAt = new Date(newSyncTime);

                    parsedFolders.push(folderData);
                } catch (e) {
                    console.error("Failed to decrypt/parse folder", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) {
                    await tx.delete(schema.folders).where(inArray(schema.folders.id, deletedIds));
                }
                for (const folderData of parsedFolders) {
                    await upsertSyncedFolder(folderData, tx);
                }
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            // Yield to UI thread
            if (i + chunkSize < cloudFolders.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    // === 2. PULL TASKS ===

    if (cloudTasks && cloudTasks.length > 0) {
        console.log(`[Sync] Received ${cloudTasks.length} updated tasks from cloud.`);
        const chunkSize = 15;
        for (let i = 0; i < cloudTasks.length; i += chunkSize) {
            const chunk = cloudTasks.slice(i, i + chunkSize);
            const deletedIds: string[] = [];
            const parsedTasks: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        // Task was permanently deleted somewhere else, remove it locally
                        deletedIds.push(row.id);
                        continue;
                    }

                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, masterKey);
                    const taskData = JSON.parse(decryptedJson);

                    taskData.createdAt = new Date(taskData.createdAt);
                    taskData.updatedAt = new Date(taskData.updatedAt);
                    taskData.deadline = new Date(taskData.deadline);
                    taskData.completedAt = taskData.completedAt ? new Date(taskData.completedAt) : null;
                    taskData.isDirty = false;
                    taskData.lastSyncedAt = new Date(newSyncTime);

                    parsedTasks.push(taskData);
                } catch (e) {
                    console.error("Failed to decrypt/parse task", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) {
                    await tx.delete(schema.tasks).where(inArray(schema.tasks.id, deletedIds));
                }
                for (const taskData of parsedTasks) {
                    await upsertSyncedTask(taskData, tx);
                }
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            // Yield to UI thread
            if (i + chunkSize < cloudTasks.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    // === 3. PULL NOTES ===

    if (cloudNotes && cloudNotes.length > 0) {
        console.log(`[Sync] Received ${cloudNotes.length} updated notes from cloud.`);
        const chunkSize = 15;
        for (let i = 0; i < cloudNotes.length; i += chunkSize) {
            const chunk = cloudNotes.slice(i, i + chunkSize);
            const deletedIds: string[] = [];
            const parsedNotes: any[] = [];

            for (const row of chunk) {
                try {
                    if (row.is_deleted) {
                        deletedIds.push(row.id);
                        continue;
                    }

                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, masterKey);
                    const noteFullData = JSON.parse(decryptedJson);

                    noteFullData.createdAt = new Date(noteFullData.createdAt);
                    noteFullData.updatedAt = new Date(noteFullData.updatedAt);
                    noteFullData.deletedAt = noteFullData.deletedAt ? new Date(noteFullData.deletedAt) : null;
                    noteFullData.isDirty = false;
                    noteFullData.lastSyncedAt = new Date(newSyncTime);

                    parsedNotes.push(noteFullData);
                } catch (e) {
                    console.error("Failed to decrypt/parse note", row.id, e);
                }
            }

            await db.transaction(async (tx: any) => {
                if (deletedIds.length > 0) {
                    await tx.delete(schema.noteMetadata).where(inArray(schema.noteMetadata.id, deletedIds));
                    await tx.delete(schema.noteContent).where(inArray(schema.noteContent.id, deletedIds));
                    await tx.delete(schema.noteVersions).where(inArray(schema.noteVersions.noteId, deletedIds));
                }
                for (const noteFullData of parsedNotes) {
                    await upsertSyncedNote(noteFullData, tx);
                }
            });
            if (deletedIds.length > 0) didDeleteTombstones = true;
            // Yield to UI thread
            if (i + chunkSize < cloudNotes.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    // Update the pointer
    await storage.setItem(getSyncTimeKey(userId), newSyncTime);

    if (didDeleteTombstones) {
        console.log('[SyncPull] Tombstones deleted locally. Running garbage collection to free space...');
        await StorageService.runGarbageCollection(true);
    }

    // === 4. PULL IMAGES (Background) ===
    // After pulling notes, let's figure out what images we are missing.
    // 1. Get all image links for this user from Supabase
    // (Optimization: we only get links for the notes we just updated or we get all links. 
    // Getting all links is simple and reliable for fixing gaps).
    const { data: cloudLinks, error: linkError } = await storageApi.getUserImageLinks(userId);

    if (linkError) {
        console.error("[SyncPull] Failed to fetch image links", linkError);
    } else if (cloudLinks && cloudLinks.length > 0) {
        // Collect unique image IDs
        const uniqueImageIds = Array.from(new Set(cloudLinks.map(l => l.image_id as string)));

        // Which ones do we already have locally?
        const localImages = await getImagesByIds(uniqueImageIds);
        const localImageIds = new Set(localImages.map((i: any) => i.id));

        const missingIds = uniqueImageIds.filter(id => !localImageIds.has(id));

        if (missingIds.length > 0) {
            console.log(`[SyncPull] Identified ${missingIds.length} missing images.`);
            // Fetch metadata for nonces
            const { data: cloudMeta, error: metaError } = await storageApi.getEncryptedImagesMetadata(userId, missingIds);

            if (!metaError && cloudMeta) {
                const downloadQueue = cloudMeta.map(meta => ({
                    imageId: meta.id,
                    noteId: '', // Note ID doesn't matter for downloading
                    nonce: meta.nonce,
                    masterKey,
                    userId
                }));

                imageSyncService.queueImagesForDownload(downloadQueue);
            }
        }
    }
}
