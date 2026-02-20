import { db, schema } from '@/lib/db/client';
import { clearDirtyFolders, getDirtyFolders, upsertSyncedFolder } from '@/lib/db/repositories/folders.repository';
import { clearDirtyNotes, getDirtyNotes, getNoteContent, upsertSyncedNote } from '@/lib/db/repositories/notes.repository';
import { clearDirtyTasks, getDirtyTasks, upsertSyncedTask } from '@/lib/db/repositories/tasks.repository';
import { StorageService } from '@/lib/services/storage.service';
import { supabase } from '@/lib/supabase';
import { decryptPayload, encryptPayload } from '@/lib/utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq, inArray } from 'drizzle-orm';

const SYNC_TIME_KEY = 'global_last_sync_time';

export async function syncPush(masterKey: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const userId = session.user.id;
    const now = new Date(); // To standardize the timestamp of this push
    let didDeleteTombstones = false;

    // === 1. FOLDERS ===
    const dirtyFolders = getDirtyFolders();
    if (dirtyFolders.length > 0) {
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

        const { error } = await supabase.from('encrypted_folders').upsert(payloadFolders);
        if (error) throw new Error(`Push folders error: ${error.message}`);

        const tombstones = dirtyFolders.filter(f => f.isPermDeleted);
        if (tombstones.length > 0) {
            db.delete(schema.folders).where(inArray(schema.folders.id, tombstones.map(f => f.id))).run();
            didDeleteTombstones = true;
        }

        const aliveFolders = dirtyFolders.filter(f => !f.isPermDeleted);
        if (aliveFolders.length > 0) {
            clearDirtyFolders(aliveFolders.map(f => f.id), now);
        }
    }

    // === 2. TASKS ===
    const dirtyTasks = getDirtyTasks();
    if (dirtyTasks.length > 0) {
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

        const { error } = await supabase.from('encrypted_tasks').upsert(payloadTasks);
        if (error) throw new Error(`Push tasks error: ${error.message}`);

        const tombstones = dirtyTasks.filter(t => t.isPermDeleted);
        if (tombstones.length > 0) {
            db.delete(schema.tasks).where(inArray(schema.tasks.id, tombstones.map(t => t.id))).run();
            didDeleteTombstones = true;
        }

        const aliveTasks = dirtyTasks.filter(t => !t.isPermDeleted);
        if (aliveTasks.length > 0) {
            clearDirtyTasks(aliveTasks.map(t => t.id), now);
        }
    }

    // === 3. NOTES ===
    const dirtyNotes = getDirtyNotes();
    if (dirtyNotes.length > 0) {
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

        const { error } = await supabase.from('encrypted_notes').upsert(payloadNotes);
        if (error) throw new Error(`Push notes error: ${error.message}`);

        const tombstones = dirtyNotes.filter(n => n.isPermDeleted);
        if (tombstones.length > 0) {
            const tombstoneIds = tombstones.map(n => n.id);
            db.delete(schema.noteContent).where(inArray(schema.noteContent.id, tombstoneIds)).run();
            db.delete(schema.noteVersions).where(inArray(schema.noteVersions.noteId, tombstoneIds)).run();
            db.delete(schema.noteMetadata).where(inArray(schema.noteMetadata.id, tombstoneIds)).run();
            didDeleteTombstones = true;
        }

        const aliveNotes = dirtyNotes.filter(n => !n.isPermDeleted);
        if (aliveNotes.length > 0) {
            clearDirtyNotes(aliveNotes.map(n => n.id), now);
        }
    }

    // Note: We don't update SyncTime here because Push doesn't necessarily mean we want to skip Pulling things that happened *during* our offline state. 

    if (didDeleteTombstones) {
        console.log('[Sync] Tombstones deleted locally. Running garbage collection to free space...');
        StorageService.runGarbageCollection(true);
    }
}

export async function syncPull(masterKey: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const userId = session.user.id;
    const lastSyncStr = await AsyncStorage.getItem(SYNC_TIME_KEY);
    const lastSyncTime = lastSyncStr ? new Date(lastSyncStr) : new Date(0); // 1970 if never synced
    const newSyncTime = new Date().toISOString(); // Time right before we fetch (prevents missing things being created right now)
    let didDeleteTombstones = false;

    console.log(`[Sync] Pulling changes modified after: ${lastSyncTime.toISOString()}`);

    // === 1. PULL FOLDERS ===
    const { data: cloudFolders, error: errorFolders } = await supabase
        .from('encrypted_folders')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncTime.toISOString());

    if (errorFolders) throw errorFolders;

    if (cloudFolders && cloudFolders.length > 0) {
        console.log(`[Sync] Received ${cloudFolders.length} updated folders from cloud.`);
        db.transaction((tx) => {
            for (const row of cloudFolders) {
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
    }

    // === 2. PULL TASKS ===
    const { data: cloudTasks, error: errorTasks } = await supabase
        .from('encrypted_tasks')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncTime.toISOString());

    if (errorTasks) throw errorTasks;

    if (cloudTasks && cloudTasks.length > 0) {
        console.log(`[Sync] Received ${cloudTasks.length} updated tasks from cloud.`);
        db.transaction((tx) => {
            for (const row of cloudTasks) {
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
    }

    // === 3. PULL NOTES ===
    const { data: cloudNotes, error: errorNotes } = await supabase
        .from('encrypted_notes')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncTime.toISOString());

    if (errorNotes) throw errorNotes;

    if (cloudNotes && cloudNotes.length > 0) {
        console.log(`[Sync] Received ${cloudNotes.length} updated notes from cloud.`);
        db.transaction((tx) => {
            for (const row of cloudNotes) {
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
    }

    // Update the pointer
    await AsyncStorage.setItem(SYNC_TIME_KEY, newSyncTime);

    if (didDeleteTombstones) {
        console.log('[SyncPull] Tombstones deleted locally. Running garbage collection to free space...');
        StorageService.runGarbageCollection(true);
    }
}
