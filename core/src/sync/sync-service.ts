import { authApi } from '../api/auth.api';
import { storageApi } from '../api/storage.api';
import { syncApi } from '../api/sync.api';
import * as schema from '../db/schema';
import { clearDirtyFolders, getDirtyFolders, upsertSyncedFolder } from '../db/repositories/folders.repository';
import { clearDirtyNotes, getDirtyNotes, getNoteContent, upsertSyncedNote } from '../db/repositories/notes.repository';
import { clearDirtyTasks, getDirtyTasks, upsertSyncedTask } from '../db/repositories/tasks.repository';
import { StorageService } from '../services/storage.service';
import { getDb } from '../stores/db.store';
import { createStorageAdapter } from '../stores/config';
import { decryptPayload, encryptPayload } from '../utils/crypto';
import { eq, inArray } from 'drizzle-orm';
import { getImagesByIds } from '../db/repositories/images.repository';
import { imageSyncService } from '../services/sync/image-sync.service';

const getSyncTimeKey = (userId: string) => `${userId}_last_sync_time`;
const storage = createStorageAdapter();

export async function resetSyncPointer(userId: string) {
    await storage.removeItem(getSyncTimeKey(userId));
    console.log(`[Sync] Reset sync pointer for user ${userId}`);
}

export async function syncPush(masterKey: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const userId = session.user.id;
    const now = new Date(); // To standardize the timestamp of this push
    let didDeleteTombstones = false;

    // === 1. FOLDERS ISOLATED PUSH ===
    const pushFolders = async () => {
        const dirtyFolders = getDirtyFolders();
        if (dirtyFolders.length === 0) return;

        const payloadFolders = dirtyFolders.map(folder => {
            const isTombstone = folder.isPermDeleted;
            const { encryptedData, nonce } = encryptPayload(JSON.stringify(folder), masterKey);
            return {
                id: folder.id,
                user_id: userId,
                updated_at: now.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        });

        const { error } = await syncApi.upsertFolders(payloadFolders);
        if (error) {
            console.error(`Push folders error: ${error.message}`);
            return;
        }

        const tombstones = dirtyFolders.filter(f => f.isPermDeleted);
        if (tombstones.length > 0) {
            getDb().delete(schema.folders).where(inArray(schema.folders.id, tombstones.map(f => f.id))).run();
            didDeleteTombstones = true;
        }

        const aliveFolders = dirtyFolders.filter(f => !f.isPermDeleted);
        if (aliveFolders.length > 0) {
            clearDirtyFolders(aliveFolders.map(f => f.id), now);
        }
    };

    // === 2. TASKS ISOLATED PUSH ===
    const pushTasks = async () => {
        const dirtyTasks = getDirtyTasks();
        if (dirtyTasks.length === 0) return;

        const payloadTasks = dirtyTasks.map(task => {
            const isTombstone = task.isPermDeleted;
            const { encryptedData, nonce } = encryptPayload(JSON.stringify(task), masterKey);
            return {
                id: task.id,
                user_id: userId,
                updated_at: now.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        });

        const { error } = await syncApi.upsertTasks(payloadTasks);
        if (error) {
            console.error(`Push tasks error: ${error.message}`);
            return;
        }

        const tombstones = dirtyTasks.filter(t => t.isPermDeleted);
        if (tombstones.length > 0) {
            getDb().delete(schema.tasks).where(inArray(schema.tasks.id, tombstones.map(t => t.id))).run();
            didDeleteTombstones = true;
        }

        const aliveTasks = dirtyTasks.filter(t => !t.isPermDeleted);
        if (aliveTasks.length > 0) {
            clearDirtyTasks(aliveTasks.map(t => t.id), now);
        }
    };

    // === 3. NOTES ISOLATED PUSH ===
    let pushedNoteIds: string[] = []; // Used for pushing images later
    const pushNotes = async () => {
        const dirtyNotes = getDirtyNotes();
        if (dirtyNotes.length === 0) return;

        pushedNoteIds = dirtyNotes.map(n => n.id);

        const payloadNotes = dirtyNotes.map(metadata => {
            const isTombstone = metadata.isPermDeleted;

            // Fetch content
            const content = getNoteContent(metadata.id);
            const dataToEncrypt = { ...metadata, content }; // Combine metadata & heavy content for cloud storage

            const { encryptedData, nonce } = encryptPayload(JSON.stringify(dataToEncrypt), masterKey);
            return {
                id: metadata.id,
                user_id: userId,
                updated_at: now.toISOString(),
                created_at: metadata.createdAt.toISOString(),
                is_deleted: isTombstone || false,
                encrypted_data: encryptedData,
                nonce: nonce,
            };
        });

        const { error } = await syncApi.upsertNotes(payloadNotes);
        if (error) {
            console.error(`Push notes error: ${error.message}`);
            return;
        }

        const tombstones = dirtyNotes.filter(n => n.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map(n => n.id);
            getDb().delete(schema.noteContent).where(inArray(schema.noteContent.id, tombstoneIds)).run();
            getDb().delete(schema.noteVersions).where(inArray(schema.noteVersions.noteId, tombstoneIds)).run();
            getDb().delete(schema.noteMetadata).where(inArray(schema.noteMetadata.id, tombstoneIds)).run();
            didDeleteTombstones = true;
        }

        const aliveNotes = dirtyNotes.filter(n => !n.isPermDeleted);
        if (aliveNotes.length > 0) {
            clearDirtyNotes(aliveNotes.map(n => n.id), now);
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
        StorageService.runGarbageCollection(true);
    }
}

export async function syncPull(masterKey: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const userId = session.user.id;
    const lastSyncStr = await storage.getItem(getSyncTimeKey(userId));
    let lastSyncTime = new Date('2000-01-01T00:00:00Z'); // Safe past date fallback

    if (lastSyncStr) {
        const parsed = new Date(lastSyncStr);
        if (!isNaN(parsed.getTime())) {
            lastSyncTime = parsed;
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
            getDb().transaction((tx) => {
                for (const row of chunk) {
                    try {
                        if (row.is_deleted) {
                            tx.delete(schema.folders).where(eq(schema.folders.id, row.id)).run();
                            didDeleteTombstones = true;
                            continue;
                        }

                        const decryptedJson = decryptPayload(row.encrypted_data, row.nonce, masterKey);
                        const folderData = JSON.parse(decryptedJson);

                        // Convert timestamps back to Date objects
                        folderData.createdAt = new Date(folderData.createdAt);
                        folderData.updatedAt = new Date(folderData.updatedAt);
                        folderData.deletedAt = folderData.deletedAt ? new Date(folderData.deletedAt) : null;
                        folderData.isDirty = false; // We just grabbed it, it's clean
                        folderData.lastSyncedAt = new Date(newSyncTime);

                        upsertSyncedFolder(folderData, tx);
                    } catch (e) {
                        console.error("Failed to decrypt/parse folder", row.id, e);
                    }
                }
            });
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
            getDb().transaction((tx) => {
                for (const row of chunk) {
                    try {
                        if (row.is_deleted) {
                            // Task was permanently deleted somewhere else, remove it locally
                            tx.delete(schema.tasks).where(eq(schema.tasks.id, row.id)).run();
                            didDeleteTombstones = true;
                            continue;
                        }

                        const decryptedJson = decryptPayload(row.encrypted_data, row.nonce, masterKey);
                        const taskData = JSON.parse(decryptedJson);

                        taskData.createdAt = new Date(taskData.createdAt);
                        taskData.updatedAt = new Date(taskData.updatedAt);
                        taskData.deadline = new Date(taskData.deadline);
                        taskData.isDirty = false;
                        taskData.lastSyncedAt = new Date(newSyncTime);

                        upsertSyncedTask(taskData, tx);
                    } catch (e) {
                        console.error("Failed to decrypt/parse task", row.id, e);
                    }
                }
            });
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
            getDb().transaction((tx) => {
                for (const row of chunk) {
                    try {
                        if (row.is_deleted) {
                            tx.delete(schema.noteMetadata).where(eq(schema.noteMetadata.id, row.id)).run();
                            tx.delete(schema.noteContent).where(eq(schema.noteContent.id, row.id)).run();
                            tx.delete(schema.noteVersions).where(eq(schema.noteVersions.noteId, row.id)).run();
                            didDeleteTombstones = true;
                            continue;
                        }

                        const decryptedJson = decryptPayload(row.encrypted_data, row.nonce, masterKey);
                        const noteFullData = JSON.parse(decryptedJson);

                        noteFullData.createdAt = new Date(noteFullData.createdAt);
                        noteFullData.updatedAt = new Date(noteFullData.updatedAt);
                        noteFullData.deletedAt = noteFullData.deletedAt ? new Date(noteFullData.deletedAt) : null;
                        noteFullData.isDirty = false;
                        noteFullData.lastSyncedAt = new Date(newSyncTime);

                        upsertSyncedNote(noteFullData, tx);

                    } catch (e) {
                        console.error("Failed to decrypt/parse note", row.id, e);
                    }
                }
            });
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
        StorageService.runGarbageCollection(true);
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
        const localImages = getImagesByIds(uniqueImageIds);
        const localImageIds = new Set(localImages.map(i => i.id));

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
