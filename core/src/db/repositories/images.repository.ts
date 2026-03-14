import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import type { DownloadQueueInsert, DownloadQueueRecord, ImageInsert, ImageRecord } from '../schema';
import { imageDownloadQueue, images, noteVersions, versionImages } from '../schema';
import type { DbOrTx } from '../types';
import { safeGet, safeGetAll } from '../utils';

export type { ImageRecord } from '../schema';

// ============ IMAGE OPERATIONS ============

export async function getImageById(imageId: string, tx: DbOrTx = getDb()): Promise<ImageRecord | null> {
    const result = await tx.select().from(images).where(eq(images.id, imageId)).get();
    const safeResult = safeGet<ImageRecord>(result);
    // Guard against Drizzle ghost object { createdAt: null } on empty results (Tauri IPC quirk)
    if (!safeResult || !safeResult.id) return null;
    return safeResult;
}

export async function getImageByLocalPath(localPath: string, tx: DbOrTx = getDb()): Promise<ImageRecord | null> {
    const result = await tx.select().from(images).where(eq(images.localPath, localPath)).get();
    const safeResult = safeGet<ImageRecord>(result);
    if (!safeResult || !safeResult.id) return null;
    return safeResult;
}

export async function getImageByHash(hash: string, tx: DbOrTx = getDb()): Promise<ImageRecord | null> {
    const result = await tx.select().from(images).where(eq(images.hash, hash)).get();
    const safeResult = safeGet<ImageRecord>(result);
    if (!safeResult || !safeResult.id) return null;
    return safeResult;
}

export async function getImagesByIds(ids: string[], tx: DbOrTx = getDb()): Promise<ImageRecord[]> {
    if (ids.length === 0) return [];
    const result = await tx.select().from(images).where(inArray(images.id, ids)).all();
    return safeGetAll<ImageRecord>(result);
}

export async function insertImage(data: ImageInsert, tx: DbOrTx = getDb()): Promise<ImageRecord> {
    return await tx.insert(images).values(data).returning().get();
}

export async function deleteImage(imageId: string, tx: DbOrTx = getDb()): Promise<void> {
    await tx.delete(images).where(eq(images.id, imageId)).run();
}

// ============ VERSION-IMAGE OPERATIONS ============

/**
 * atomic update of images for a version
 */
export async function setImagesForVersion(versionId: string, imageIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    // 1. Delete existing associations for this version
    await tx.delete(versionImages).where(eq(versionImages.versionId, versionId)).run();

    // 2. Insert new associations
    const uniqueImageIds = Array.from(new Set(imageIds));
    if (uniqueImageIds.length > 0) {
        await tx.insert(versionImages)
            .values(uniqueImageIds.map(imageId => ({ versionId, imageId })))
            .run();
    }
}

export async function deleteImagesForVersions(versionIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (versionIds.length === 0) return;
    await tx.delete(versionImages).where(inArray(versionImages.versionId, versionIds)).run();
}

export async function countImageReferences(imageId: string, tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx
        .select({ count: sql<number>`count(*)` })
        .from(versionImages)
        .where(eq(versionImages.imageId, imageId))
        .get();
    const safeResult = safeGet<{ count: number }>(result);
    return safeResult?.count ?? 0;
}

// ============ GC OPERATIONS ============
export async function getImageIdsForVersions(versionIds: string[], tx: DbOrTx = getDb()): Promise<string[]> {
    if (versionIds.length === 0) return [];
    const result = await tx.select({ imageId: versionImages.imageId })
        .from(versionImages)
        .where(inArray(versionImages.versionId, versionIds))
        .all();
    return safeGetAll<{ imageId: string }>(result).map(r => r.imageId);
}

/**
 * Garbage Collection: Delete images that are not referenced by ANY version
 * and are older than 5 minutes (to avoid race conditions with new uploads).
 */
export async function deleteUnreferencedImages(tx: DbOrTx = getDb(), ignoreTimeBuffer = false): Promise<string[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Find orphan images
    let condition;
    if (ignoreTimeBuffer) {
        // Strict check: Not in version_images at all
        condition = sql`${images.id} NOT IN (SELECT ${versionImages.imageId} FROM ${versionImages})`;
    } else {
        // Safe check: Not in version_images AND old enough
        condition = and(
            sql`${images.id} NOT IN (SELECT ${versionImages.imageId} FROM ${versionImages})`,
            sql`${images.createdAt} < ${fiveMinutesAgo.toISOString()}`
        );
    }

    const orphans = await tx.select({ id: images.id, localPath: images.localPath })
        .from(images)
        .where(condition)
        .all();
    const safeOrphans = safeGetAll<{ id: string, localPath: string }>(orphans);
    if (safeOrphans.length === 0) return [];

    const orphanIds = safeOrphans.map(o => o.id);

    // Delete DB records
    await tx.delete(images).where(inArray(images.id, orphanIds)).run();

    // Return paths so caller can delete files
    return safeOrphans.map(o => o.localPath);
}

/**
 * delete specific images permissions if they are no longer referenced by any version.
 * Used when permanently deleting notes/versions to clean up immediately (ignoring time buffer).
 */
export async function deleteImagesIfUnreferenced(imageIds: string[], tx: DbOrTx = getDb()): Promise<string[]> {
    if (imageIds.length === 0) return [];

    // Filter to find which of these are TRULY unreferenced now
    const trulyOrphaned: string[] = [];
    for (const id of imageIds) {
        const countRes = await tx
            .select({ count: sql<number>`count(*)` })
            .from(versionImages)
            .where(eq(versionImages.imageId, id))
            .get();
        const safeCountRes = safeGet<{ count: number }>(countRes);
        if ((safeCountRes?.count ?? 0) === 0) {
            trulyOrphaned.push(id);
        }
    }

    if (trulyOrphaned.length === 0) return [];

    // Get paths before deleting
    const filesToDelete = await tx.select({ localPath: images.localPath })
        .from(images)
        .where(inArray(images.id, trulyOrphaned))
        .all();

    const safeFilesToDelete = safeGetAll<{ localPath: string }>(filesToDelete);

    // Delete DB records
    await tx.delete(images).where(inArray(images.id, trulyOrphaned)).run();

    return safeFilesToDelete.map(f => f.localPath);
}

// a ghost object or an array (Tauri SQLite driver quirk).
// Replaced by safeGet in utils.ts
// function safeGet<T>(row: unknown, key: string, fallback: T): T {
// ...
// }

export async function getStorageStats(tx: DbOrTx = getDb()) {
    const imgCountRow = await tx.select({ count: sql<number>`count(*)` }).from(images).get();
    const totalImages = safeGet<{ count: number }>(imgCountRow)?.count ?? 0;

    const linkCountRow = await tx.select({ count: sql<number>`count(*)` }).from(versionImages).get();
    const totalLinks = safeGet<{ count: number }>(linkCountRow)?.count ?? 0;

    const imgSizeRow = await tx.select({ sum: sql<number>`sum(${images.size})` }).from(images).get();
    const totalImagesSize = safeGet<{ sum: number }>(imgSizeRow)?.sum ?? 0;

    // Orphans (ignoring time buffer)
    const orphanRow = await tx.select({ count: sql<number>`count(*)` })
        .from(images)
        .where(sql`${images.id} NOT IN (SELECT ${versionImages.imageId} FROM ${versionImages})`)
        .get();
    const orphans = safeGet<{ count: number }>(orphanRow)?.count ?? 0;

    return { totalImages, totalLinks, orphans, totalImagesSize };
}

export async function deleteOrphanLinks(tx: DbOrTx = getDb()): Promise<void> {
    // Delete links pointing to non-existent versions
    await tx.delete(versionImages)
        .where(
            sql`${versionImages.versionId} NOT IN (SELECT ${noteVersions.id} FROM ${noteVersions})`
        )
        .run();
}

// ============ SYNC OPERATIONS ============

/**
 * Returns a list of image records that are pending sync AND are linked to the 
 * latest version of any note. We skip images that are only in older history.
 */
export async function getPendingImagesLinkedToLatestVersions(tx: DbOrTx = getDb()): Promise<{
    image: ImageRecord;
    noteId: string;
}[]> {
    // 1. Get the latest version ID for each note
    // Note: SQLite doesn't have a clean DISTINCT ON, so we do it with a subquery or group by hack.
    // We'll use a subquery to find max created_at per note.
    const latestVersionsSubquery = await tx
        .select({
            id: noteVersions.id,
            noteId: noteVersions.noteId
        })
        .from(noteVersions)
        .where(
            sql`${noteVersions.createdAt} = (SELECT MAX(v2.created_at) FROM ${noteVersions} v2 WHERE v2.note_id = ${noteVersions.noteId})`
        )
        .all();

    if (latestVersionsSubquery.length === 0) return [];

    const safeLatestVersions = safeGetAll<{ id: string, noteId: string }>(latestVersionsSubquery);

    const latestVersionIds = safeLatestVersions.map(v => v.id);

    // 2. Find images linked to those versions that are pending
    const results = await tx
        .select({
            image: images,
            versionId: versionImages.versionId,
        })
        .from(images)
        .innerJoin(versionImages, eq(images.id, versionImages.imageId))
        .where(
            and(
                eq(images.syncStatus, 'pending'),
                inArray(versionImages.versionId, latestVersionIds)
            )
        )
        .all();

    const safeResults = safeGetAll<{ image: ImageRecord; versionId: string }>(results);

    // 3. Map back to include the noteId for easier insertion into note_images later
    const versionNoteMap = new Map(
        safeLatestVersions.map(v => [v.id, v.noteId] as const),
    );

    // We might have duplicates if an image is in multiple head versions of DIFFERENT notes.
    // We return all occurrences because we need to link each note to the image in the cloud.
    return safeResults.map(row => ({
        image: row.image,
        noteId: versionNoteMap.get(row.versionId) as string,
    }));
}

/**
 * Returns the latest-version image IDs for each provided note ID.
 * Notes without a latest version (or without linked images) are returned with an empty imageIds array.
 */
export async function getLatestVersionImageIdsForNotes(noteIds: string[], tx: DbOrTx = getDb()): Promise<{
    noteId: string;
    imageIds: string[];
}[]> {
    const uniqueNoteIds = Array.from(new Set(noteIds));
    if (uniqueNoteIds.length === 0) return [];

    const latestVersions = await tx
        .select({
            id: noteVersions.id,
            noteId: noteVersions.noteId,
        })
        .from(noteVersions)
        .where(
            and(
                inArray(noteVersions.noteId, uniqueNoteIds),
                sql`${noteVersions.createdAt} = (SELECT MAX(v2.created_at) FROM ${noteVersions} v2 WHERE v2.note_id = ${noteVersions.noteId})`
            )
        )
        .all();

    const safeLatestVersions = safeGetAll<{ id: string, noteId: string }>(latestVersions);

    const imageIdsByNote = new Map<string, Set<string>>();
    for (const noteId of uniqueNoteIds) {
        imageIdsByNote.set(noteId, new Set<string>());
    }

    if (safeLatestVersions.length === 0) {
        return uniqueNoteIds.map(noteId => ({ noteId, imageIds: [] }));
    }

    const latestVersionIds = safeLatestVersions.map(v => v.id);
    const versionToNote = new Map(
        safeLatestVersions.map(v => [v.id, v.noteId] as const),
    );

    const links = await tx
        .select({
            versionId: versionImages.versionId,
            imageId: versionImages.imageId,
        })
        .from(versionImages)
        .where(inArray(versionImages.versionId, latestVersionIds))
        .all();

    const safeLinks = safeGetAll<{ versionId: string, imageId: string }>(links);

    for (const link of safeLinks) {
        const noteId = versionToNote.get(link.versionId) as string | undefined;
        if (!noteId) continue;
        imageIdsByNote.get(noteId)?.add(link.imageId as string);
    }

    return uniqueNoteIds.map(noteId => ({
        noteId,
        imageIds: Array.from(imageIdsByNote.get(noteId) ?? []),
    }));
}

export async function markImagesAsSynced(imageIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (imageIds.length === 0) return;
    await tx.update(images)
        .set({ syncStatus: 'synced' })
        .where(inArray(images.id, imageIds))
        .run();
}
// Revert images to pending (used when sync fails)
export async function revertImagesToPending(imageIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (imageIds.length === 0) return;
    await tx.update(images)
        .set({ syncStatus: 'pending' })
        .where(inArray(images.id, imageIds))
        .run();
}

// ============ DOWNLOAD QUEUE OPERATIONS ============

export async function upsertDownloadQueue(items: DownloadQueueInsert[], tx: DbOrTx = getDb()): Promise<void> {
    if (items.length === 0) return;

    // Insert batch. If the imageId is already in the queue, ignore it.
    await tx.insert(imageDownloadQueue)
        .values(items)
        .onConflictDoNothing()
        .run();
}

export async function removeFromDownloadQueue(imageId: string, tx: DbOrTx = getDb()): Promise<void> {
    await tx.delete(imageDownloadQueue)
        .where(eq(imageDownloadQueue.imageId, imageId))
        .run();
}

export async function getPendingDownloads(tx: DbOrTx = getDb()): Promise<DownloadQueueRecord[]> {
    // Fetch all pending downloads to retry them
    const result = await tx.select().from(imageDownloadQueue).all();
    return safeGetAll<DownloadQueueRecord>(result);
}
