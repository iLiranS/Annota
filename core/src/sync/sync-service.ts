import { eq, or } from 'drizzle-orm';
import { authApi } from '../api/auth.api';
import { storageApi } from '../api/storage.api';
import { syncApi } from '../api/sync.api';
import { getFilesByIds } from '../db/repositories/files.repository';
import { clearDirtyFolders, getDirtyFolders, upsertSyncedFolder, } from '../db/repositories/folders.repository';
import { clearDirtyNotes, getDirtyNotes, getNoteContent, upsertSyncedNote, } from '../db/repositories/notes.repository';
import { clearDirtyTags, getDirtyTags, upsertSyncedTag, } from '../db/repositories/tags.repository';
import { clearDirtyTasks, getDirtyTasks, upsertSyncedTask, } from '../db/repositories/tasks.repository';
import * as schema from '../db/schema';
import { fileSyncService } from '../services/files/file-sync.service';
import { StorageService } from '../services/storage.service';
import { createStorageAdapter } from '../stores/config';
import { getDb } from '../stores/db.store';
import { useSyncStore } from '../stores/sync.store';
import { decodeSaltHex, decryptPayload, deriveKeysFromMnemonic, encryptPayload } from '../utils/crypto';

const getSyncTimeKey = (userId: string) => `${userId}_last_sync_time`;

// Placeholders removed

async function getDerivedKeys(mnemonic: string, saltHex: string) {
    const { derivedMasterKey, notesKey, filesKey, activeMnemonic, activeSaltHex, setDerivedKeys } = useSyncStore.getState();
    if (derivedMasterKey && notesKey && filesKey && activeMnemonic === mnemonic && activeSaltHex === saltHex) {
        return { masterKey: derivedMasterKey, notesKey, filesKey };
    }
    const saltBytes = decodeSaltHex(saltHex);
    const keys = await deriveKeysFromMnemonic(mnemonic, saltBytes);
    const cached = {
        masterKey: Buffer.from(keys.masterKey),
        notesKey: Buffer.from(keys.notesKey),
        filesKey: Buffer.from(keys.filesKey),
    };
    setDerivedKeys(mnemonic, saltHex, cached);
    return cached;
}

export async function resetSyncPointer(userId: string) {
    const storage = createStorageAdapter();
    await storage.removeItem(getSyncTimeKey(userId));
    console.log(`[Sync] Reset sync pointer for user ${userId}`);
}

/**
 * Internal push implementation.
 * @internal Use syncPush instead.
 */
export async function performSyncPush(masterKey: string, saltHex: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const db = getDb();
    const userId = session.user.id;
    const now = new Date();
    let didDeleteTombstones = false;

    const { notesKey } = await getDerivedKeys(masterKey, saltHex);

    const pushFolders = async () => {
        const dirtyFolders = await getDirtyFolders();
        if (dirtyFolders.length === 0) return;

        const payloadFolders = await Promise.all(dirtyFolders.map(async (folder) => {
            const isTombstone = folder.isPermDeleted;
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(folder), notesKey);
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
            for (const f of tombstones) {
                await db.delete(schema.folders).where(eq(schema.folders.id, f.id)).execute();
            }
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
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(tag), notesKey);
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
            for (const t of tombstones) {
                await db.delete(schema.tags).where(eq(schema.tags.id, t.id)).execute();
            }
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
            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(task), notesKey);
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
            for (const t of tombstones) {
                await db.delete(schema.tasks).where(eq(schema.tasks.id, t.id)).execute();
            }
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

            const { encryptedData, nonce } = await encryptPayload(JSON.stringify(dataToEncrypt), notesKey);
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
            await db.transaction(async (tx: any) => {
                for (const n of tombstones) {
                    await tx.delete(schema.noteContent).where(eq(schema.noteContent.id, n.id)).execute();
                    await tx.delete(schema.noteVersions).where(eq(schema.noteVersions.noteId, n.id)).execute();
                    await tx.delete(schema.noteMetadata).where(eq(schema.noteMetadata.id, n.id)).execute();
                }
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
        await fileSyncService.pushFiles(masterKey, saltHex, userId, pushedNoteIds);
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
export async function performSyncPull(masterKey: string, saltHex: string) {
    const { data: { session } } = await authApi.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const db = getDb();
    const userId = session.user.id;
    const { lastSyncAt } = useSyncStore.getState();
    const lastSyncTime = lastSyncAt ?? new Date('2000-01-01T00:00:00Z');

    let didDeleteTombstones = false;

    const { notesKey } = await getDerivedKeys(masterKey, saltHex);

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
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, notesKey);
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

            if (deletedIds.length > 0) {
                try {
                    for (const rawId of deletedIds) {
                        const id = String(rawId).trim();
                        const hyphenlessId = id.replace(/-/g, '');
                        await db.delete(schema.folders)
                            .where(or(
                                eq(schema.folders.id, id),
                                eq(schema.folders.id, hyphenlessId)
                            ))
                            .execute();
                    }
                } catch (e) {
                    console.error("Failed to delete folders", deletedIds, e);
                }
                didDeleteTombstones = true;
            }

            if (parsedFolders.length > 0) {
                await db.transaction(async (tx: any) => {
                    for (const f of parsedFolders) await upsertSyncedFolder(f, tx);
                });
            }
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
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, notesKey);
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

            if (deletedIds.length > 0) {
                try {
                    for (const rawId of deletedIds) {
                        const id = String(rawId).trim();
                        // 1. Try to match with exact hyphenated UUID from Supabase
                        // 2. OR match with trimmed hyphenless ID (for legacy local data)
                        const hyphenlessId = id.replace(/-/g, '');

                        await db.delete(schema.tasks)
                            .where(or(
                                eq(schema.tasks.id, id),
                                eq(schema.tasks.id, hyphenlessId)
                            ))
                            .execute();
                    }
                } catch (e) {
                    console.error("Failed to delete tasks", deletedIds, e);
                }
                didDeleteTombstones = true;
            }

            if (parsedTasks.length > 0) {
                await db.transaction(async (tx: any) => {
                    for (const t of parsedTasks) await upsertSyncedTask(t, tx);
                });
            }
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
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, notesKey);
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

            if (deletedIds.length > 0) {
                try {
                    for (const rawId of deletedIds) {
                        const id = String(rawId).trim();
                        const hyphenlessId = id.replace(/-/g, '');
                        await db.delete(schema.tags)
                            .where(or(
                                eq(schema.tags.id, id),
                                eq(schema.tags.id, hyphenlessId)
                            ))
                            .execute();
                    }
                } catch (e) {
                    console.error("Failed to delete tags", deletedIds, e);
                }
                didDeleteTombstones = true;
            }

            if (parsedTags.length > 0) {
                await db.transaction(async (tx: any) => {
                    for (const t of parsedTags) await upsertSyncedTag(t, tx);
                });
            }
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
                    const decryptedJson = await decryptPayload(row.encrypted_data, row.nonce, notesKey);
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

            if (deletedIds.length > 0) {
                try {
                    await db.transaction(async (tx: any) => {
                        for (const rawId of deletedIds) {
                            const id = String(rawId).trim();
                            const hyphenlessId = id.replace(/-/g, '');

                            // Delete children before parent to respect Foreign Keys
                            await tx.delete(schema.noteContent)
                                .where(or(
                                    eq(schema.noteContent.id, id),
                                    eq(schema.noteContent.id, hyphenlessId)
                                ))
                                .execute();

                            await tx.delete(schema.noteVersions)
                                .where(or(
                                    eq(schema.noteVersions.noteId, id),
                                    eq(schema.noteVersions.noteId, hyphenlessId)
                                ))
                                .execute();

                            await tx.delete(schema.noteMetadata)
                                .where(or(
                                    eq(schema.noteMetadata.id, id),
                                    eq(schema.noteMetadata.id, hyphenlessId)
                                ))
                                .execute();
                        }
                    });
                } catch (e) {
                    console.error("Failed to delete notes", deletedIds, e);
                }
                didDeleteTombstones = true;
            }

            if (parsedNotes.length > 0) {
                await db.transaction(async (tx: any) => {
                    for (const n of parsedNotes) await upsertSyncedNote(n, tx);
                });
            }
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
    const { data: cloudLinks, error: linkError } = await storageApi.getUserFileLinks(userId, fetchedNoteIds);
    if (!linkError && cloudLinks && cloudLinks.length > 0) {
        const uniqueFileIds = Array.from(new Set(cloudLinks.map(l => l.file_id as string)));
        const localFiles = await getFilesByIds(uniqueFileIds);
        const localFileIds = new Set(localFiles.map((i: any) => i.id));
        const missingIds = uniqueFileIds.filter(id => !localFileIds.has(id));

        if (missingIds.length > 0) {
            const { data: cloudMeta, error: metaError } = await storageApi.getEncryptedFilesMetadata(userId, missingIds);
            if (!metaError && cloudMeta) {
                const downloadQueue = cloudMeta.map(meta => ({
                    fileId: meta.id,
                    noteId: '',
                    nonce: meta.nonce,
                    masterKey,
                    saltHex,
                    userId
                }));
                fileSyncService.queueFilesForDownload(downloadQueue);
            }
        }
    }
}

/**
 * Public wrapper that handles isSyncing lock and offline checks.
 * This is the ONLY method that should be called by components/schedulers.
 */
export async function syncPush(masterKey: string, saltHex: string): Promise<boolean> {
    const store = useSyncStore.getState();
    if (!store.isOnline) return false;

    if (store.isSyncing) {
        console.log('[syncPush] Skipped — already in-flight');
        return false;
    }

    store.setSyncing(true);
    try {
        await performSyncPush(masterKey, saltHex);
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
export async function syncPull(masterKey: string, saltHex: string): Promise<boolean> {
    const store = useSyncStore.getState();
    if (!store.isOnline) return false;

    if (store.isSyncing) {
        console.log('[syncPull] Skipped — already in-flight');
        return false;
    }

    store.setSyncing(true);
    try {
        await performSyncPull(masterKey, saltHex);
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
