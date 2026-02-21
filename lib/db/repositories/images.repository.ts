import { getDb } from '@/stores/db-store';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DbOrTx } from '../client';
import type { ImageInsert, ImageRecord } from '../schema';
import { images, noteVersions, versionImages } from '../schema';

export type { ImageRecord } from '../schema';

// ============ IMAGE OPERATIONS ============

export function getImageById(imageId: string, tx: DbOrTx = getDb()): ImageRecord | null {
    const result = tx.select().from(images).where(eq(images.id, imageId)).get();
    return result ?? null;
}

export function getImageByHash(hash: string, tx: DbOrTx = getDb()): ImageRecord | null {
    const result = tx.select().from(images).where(eq(images.hash, hash)).get();
    return result ?? null;
}

export function getImagesByIds(ids: string[], tx: DbOrTx = getDb()): ImageRecord[] {
    if (ids.length === 0) return [];
    return tx.select().from(images).where(inArray(images.id, ids)).all();
}

export function insertImage(data: ImageInsert, tx: DbOrTx = getDb()): ImageRecord {
    return tx.insert(images).values(data).returning().get();
}

export function deleteImage(imageId: string, tx: DbOrTx = getDb()): void {
    tx.delete(images).where(eq(images.id, imageId)).run();
}

// ============ VERSION-IMAGE OPERATIONS ============

/**
 * atomic update of images for a version
 */
export function setImagesForVersion(versionId: string, imageIds: string[], tx: DbOrTx = getDb()): void {
    // 1. Delete existing associations for this version
    tx.delete(versionImages).where(eq(versionImages.versionId, versionId)).run();

    // 2. Insert new associations
    const uniqueImageIds = Array.from(new Set(imageIds));
    if (uniqueImageIds.length > 0) {
        tx.insert(versionImages)
            .values(uniqueImageIds.map(imageId => ({ versionId, imageId })))
            .run();
    }
}

export function deleteImagesForVersions(versionIds: string[], tx: DbOrTx = getDb()): void {
    if (versionIds.length === 0) return;
    tx.delete(versionImages).where(inArray(versionImages.versionId, versionIds)).run();
}

export function countImageReferences(imageId: string, tx: DbOrTx = getDb()): number {
    const result = tx
        .select({ count: sql<number>`count(*)` })
        .from(versionImages)
        .where(eq(versionImages.imageId, imageId))
        .get();
    return result?.count ?? 0;
}

// ============ GC OPERATIONS ============
export function getImageIdsForVersions(versionIds: string[], tx: DbOrTx = getDb()): string[] {
    if (versionIds.length === 0) return [];
    return tx.select({ imageId: versionImages.imageId })
        .from(versionImages)
        .where(inArray(versionImages.versionId, versionIds))
        .all()
        .map(r => r.imageId);
}

/**
 * Garbage Collection: Delete images that are not referenced by ANY version
 * and are older than 5 minutes (to avoid race conditions with new uploads).
 */
export function deleteUnreferencedImages(tx: DbOrTx = getDb(), ignoreTimeBuffer = false): string[] {
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

    const orphans = tx.select({ id: images.id, localPath: images.localPath })
        .from(images)
        .where(condition)
        .all();
    if (orphans.length === 0) return [];

    const orphanIds = orphans.map(o => o.id);

    // Delete DB records
    tx.delete(images).where(inArray(images.id, orphanIds)).run();

    // Return paths so caller can delete files
    return orphans.map(o => o.localPath);
}

/**
 * delete specific images permissions if they are no longer referenced by any version.
 * Used when permanently deleting notes/versions to clean up immediately (ignoring time buffer).
 */
export function deleteImagesIfUnreferenced(imageIds: string[], tx: DbOrTx = getDb()): string[] {
    if (imageIds.length === 0) return [];

    // Filter to find which of these are TRULY unreferenced now
    // (We assume the caller has ALREADY deleted the version_images links for the context they are removing)
    const trulyOrphaned = imageIds.filter(id => {
        const count = tx
            .select({ count: sql<number>`count(*)` })
            .from(versionImages)
            .where(eq(versionImages.imageId, id))
            .get()?.count ?? 0;
        return count === 0;
    });

    if (trulyOrphaned.length === 0) return [];

    // Get paths before deleting
    const filesToDelete = tx.select({ localPath: images.localPath })
        .from(images)
        .where(inArray(images.id, trulyOrphaned))
        .all();

    // Delete DB records
    tx.delete(images).where(inArray(images.id, trulyOrphaned)).run();

    return filesToDelete.map(f => f.localPath);
}

export function getStorageStats(tx: DbOrTx = getDb()) {
    const totalImages = tx.select({ count: sql<number>`count(*)` }).from(images).get()?.count ?? 0;
    const totalLinks = tx.select({ count: sql<number>`count(*)` }).from(versionImages).get()?.count ?? 0;
    const totalImagesSize = tx.select({ sum: sql<number>`sum(${images.size})` }).from(images).get()?.sum ?? 0;

    // Orphans (ignoring time buffer)
    const orphans = tx.select({ count: sql<number>`count(*)` })
        .from(images)
        .where(sql`${images.id} NOT IN (SELECT ${versionImages.imageId} FROM ${versionImages})`)
        .get()?.count ?? 0;

    return { totalImages, totalLinks, orphans, totalImagesSize };
}

export function deleteOrphanLinks(tx: DbOrTx = getDb()): void {
    // Delete links pointing to non-existent versions
    tx.delete(versionImages)
        .where(
            sql`${versionImages.versionId} NOT IN (SELECT ${noteVersions.id} FROM ${noteVersions})`
        )
        .run();
}
