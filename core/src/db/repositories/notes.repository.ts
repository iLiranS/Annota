import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { deleteImageFile } from '../../services/images/image.service';
import { getDb } from '../../stores/db.store';
import { generateId } from '../../utils/id';
import type { NoteMetadata, NoteMetadataInsert } from '../schema';
import * as schema from '../schema';
import type { DbOrTx } from '../types';
import * as ImagesRepo from './images.repository';

// Re-export types for convenience
export type { NoteMetadata, NoteVersion } from '../schema';

function normalizeStoredContent(content: string): string {
    if (!content) return content ?? '';
    // Keep image references by data-image-id, but strip heavy src payloads
    // (typically base64 data URIs injected only for rendering in WebView).
    return content.replace(/<img\b[^>]*>/gi, (imgTag) => {
        if (!/data-image-id\s*=\s*["'][^"']+["']/i.test(imgTag)) {
            return imgTag;
        }

        // TipTap Image.parseHTML expects img[src] to exist.
        // Canonical form for local images is src="" + data-image-id.
        let normalized = imgTag
            .replace(/\s+src\s*=\s*(["']).*?\1/gi, ' src=""')
            .replace(/\s+src\s*=\s*[^\s>]+/gi, ' src=""');

        if (!/\s+src\s*=/i.test(normalized)) {
            normalized = normalized.replace(/\s*\/?>$/, (end) => ` src=""${end}`);
        }

        return normalized;
    });
}

function extractImageIdsFromContent(content: string): string[] {
    const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        ids.push(match[2]);
    }
    return ids;
}



// ============ SYNC OPERATIONS ============

export async function getDirtyNotes(): Promise<NoteMetadata[]> {
    return await getDb().select().from(schema.noteMetadata).where(eq(schema.noteMetadata.isDirty, true)).all();
}

export async function clearDirtyNotes(noteIds: string[]): Promise<void> {
    if (noteIds.length === 0) return;
    await getDb().update(schema.noteMetadata)
        .set({ isDirty: false })
        .where(inArray(schema.noteMetadata.id, noteIds))
        .run();
}

export async function upsertSyncedNote(noteFullData: any, tx: DbOrTx = getDb()): Promise<void> {
    const existing = await tx.select().from(schema.noteMetadata).where(eq(schema.noteMetadata.id, noteFullData.id)).get();
    if (existing && existing.updatedAt > noteFullData.updatedAt) {
        console.log(`[Sync] Local note ${noteFullData.id} is newer, ignoring pulled row. Local: ${existing.updatedAt}, Pulled: ${noteFullData.updatedAt}`);
        return;
    }

    const content = normalizeStoredContent(noteFullData.content || '');
    const metadataDetails = { ...noteFullData };
    delete metadataDetails.content; // The rest is metadata

    // Insert or Update Metadata
    await tx.insert(schema.noteMetadata)
        .values(metadataDetails)
        .onConflictDoUpdate({ target: schema.noteMetadata.id, set: metadataDetails })
        .run();

    // Insert or Update Content (Heavy Data)
    await tx.insert(schema.noteContent)
        .values({ id: metadataDetails.id, content })
        .onConflictDoUpdate({ target: schema.noteContent.id, set: { content } })
        .run();

    const noteUpdatedAt = metadataDetails.updatedAt instanceof Date ? metadataDetails.updatedAt : new Date();
    const imageIds = extractImageIdsFromContent(content);
    const MAX_VERSIONS = 50;

    // Keep the synced note represented by a local version so image links are not orphaned.
    const latestVersion = await tx.select({
        id: schema.noteVersions.id,
        content: schema.noteVersions.content,
    })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.noteId, metadataDetails.id))
        .orderBy(desc(schema.noteVersions.createdAt))
        .limit(1)
        .get();

    let activeVersionId: string;

    if (!latestVersion) {
        activeVersionId = generateId();
        await tx.insert(schema.noteVersions).values({
            id: activeVersionId,
            noteId: metadataDetails.id,
            content,
            createdAt: noteUpdatedAt,
        }).run();
    } else {
        const latestNormalizedContent = normalizeStoredContent(latestVersion.content);
        if (latestNormalizedContent !== latestVersion.content) {
            await tx.update(schema.noteVersions)
                .set({ content: latestNormalizedContent })
                .where(eq(schema.noteVersions.id, latestVersion.id))
                .run();
        }

        if (latestNormalizedContent === content) {
            activeVersionId = latestVersion.id;
        } else {
            activeVersionId = generateId();
            await tx.insert(schema.noteVersions).values({
                id: activeVersionId,
                noteId: metadataDetails.id,
                content,
                createdAt: noteUpdatedAt,
            }).run();

            const versions = await tx.select({ id: schema.noteVersions.id })
                .from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, metadataDetails.id))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            if (versions.length > MAX_VERSIONS) {
                const versionsToDelete = versions.slice(MAX_VERSIONS).map((v: { id: string }) => v.id);
                if (versionsToDelete.length > 0) {
                    await ImagesRepo.deleteImagesForVersions(versionsToDelete, tx);
                    await tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, versionsToDelete))
                        .run();
                }
            }
        }
    }

    await ImagesRepo.setImagesForVersion(activeVersionId, imageIds, tx);
}

// ============ METADATA OPERATIONS (fast, for lists) ============

export async function getNotesInFolder(folderId: string | null, includeDeleted = false): Promise<NoteMetadata[]> {
    if (folderId === null) {
        if (includeDeleted) {
            return await getDb()
                .select()
                .from(schema.noteMetadata)
                .where(isNull(schema.noteMetadata.folderId))
                .all();
        }
        return await getDb()
            .select()
            .from(schema.noteMetadata)
            .where(
                and(
                    isNull(schema.noteMetadata.folderId),
                    eq(schema.noteMetadata.isDeleted, false),
                    eq(schema.noteMetadata.isPermDeleted, false)
                )
            )
            .all();
    }

    if (includeDeleted) {
        return await getDb()
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.folderId, folderId))
            .all();
    }

    return await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.folderId, folderId),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
}

export async function getNoteMetadataById(noteId: string): Promise<NoteMetadata | null> {
    const result = await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.id, noteId))
        .get();

    return result ?? null;
}

export async function createNoteMetadata(metadata: NoteMetadataInsert): Promise<NoteMetadata> {
    // 2. Run as a TRANSACTION (All or Nothing)
    return await getDb().transaction(async (tx: DbOrTx) => {
        // A. Insert Metadata
        const insertedNote = await tx.insert(schema.noteMetadata)
            .values(metadata)
            .returning()
            .get();

        // B. Insert Empty Content
        await tx.insert(schema.noteContent).values({
            id: metadata.id,
            content: '',
        }).run();

        return insertedNote!;
    });
}

export async function updateNoteMetadata(noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>): Promise<NoteMetadata> {
    const noteMetadata = await getDb()
        .update(schema.noteMetadata)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.noteMetadata.id, noteId))
        .returning()
        .get();
    return noteMetadata;
}


export async function softDeleteNote(noteId: string): Promise<void> {
    const note = await getNoteMetadataById(noteId);
    if (!note) return;

    const now = new Date();
    await getDb()
        .update(schema.noteMetadata)
        .set({
            isDeleted: true,
            deletedAt: now,
            originalFolderId: note.folderId,
            folderId: 'system-trash',
            updatedAt: now,
        })
        .where(eq(schema.noteMetadata.id, noteId))
        .run();
}

export async function restoreNote(noteId: string, targetFolderId?: string | null): Promise<void> {
    const note = await getNoteMetadataById(noteId);
    if (!note) return;

    const now = new Date();

    // Determine restore location
    let restoredFolderId: string | null = null;
    if (targetFolderId !== undefined) {
        restoredFolderId = targetFolderId;
    } else if (note.originalFolderId) {
        // Check if original folder exists and is not deleted
        const originalFolder = await getDb()
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.id, note.originalFolderId))
            .get();

        if (originalFolder && !originalFolder.isDeleted) {
            restoredFolderId = note.originalFolderId;
        }
        // If original folder is deleted or doesn't exist, restore to root (null)
    }

    await getDb()
        .update(schema.noteMetadata)
        .set({
            isDeleted: false,
            deletedAt: null,
            folderId: restoredFolderId,
            originalFolderId: null,
            updatedAt: now,
        })
        .where(eq(schema.noteMetadata.id, noteId))
        .run();
}

export async function permanentlyDeleteNote(noteId: string): Promise<void> {
    await getDb().transaction(async (tx: DbOrTx) => {
        // We defer all deletions to allow the full object to sync as a tombstone
        await tx.update(schema.noteMetadata)
            .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
            .where(eq(schema.noteMetadata.id, noteId))
            .run();
    });
}

export async function getQuickAccessNotes(): Promise<NoteMetadata[]> {
    return await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.isQuickAccess, true),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
}

export async function getPinnedNotesInFolder(folderId: string): Promise<NoteMetadata[]> {
    return await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.folderId, folderId),
                eq(schema.noteMetadata.isPinned, true),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
}

export async function getDeletedNotes(): Promise<NoteMetadata[]> {
    return await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.isDeleted, true),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
}

// ============ CONTENT OPERATIONS (lazy loaded) ============

export async function getNoteContent(noteId: string): Promise<string> {
    const result = await getDb()
        .select()
        .from(schema.noteContent)
        .where(eq(schema.noteContent.id, noteId))
        .get();

    const rawContent = result?.content ?? '';
    const normalized = normalizeStoredContent(rawContent);

    // Self-heal previously stored rows that lost src attribute.
    if (result && normalized !== rawContent) {
        await getDb().update(schema.noteContent)
            .set({ content: normalized })
            .where(eq(schema.noteContent.id, noteId))
            .run();
    }

    return normalized;
}

export async function updateNoteContent(noteId: string, content: string, preview: string): Promise<void> {
    const now = new Date();
    const VERSION_THRESHOLD_MS = 10000; // 10 seconds
    const MAX_VERSIONS = 50;
    const normalizedContent = normalizeStoredContent(content);

    // Extract image IDs from canonical content
    const imageIds = extractImageIdsFromContent(normalizedContent);

    // 1. Update current content (Always)
    await getDb().transaction(async (tx: DbOrTx) => {
        await tx.update(schema.noteContent)
            .set({ content: normalizedContent })
            .where(eq(schema.noteContent.id, noteId))
            .run();

        // 2. Update preview in metadata
        await tx.update(schema.noteMetadata)
            .set({ preview, updatedAt: now })
            .where(eq(schema.noteMetadata.id, noteId))
            .run();

        // 3. Handle Versioning
        // Get latest version
        const latestVersion = await tx.select()
            .from(schema.noteVersions)
            .where(eq(schema.noteVersions.noteId, noteId))
            .orderBy(desc(schema.noteVersions.createdAt))
            .limit(1)
            .get();

        let activeVersionId: string;

        if (!latestVersion || (now.getTime() - latestVersion.createdAt.getTime() > VERSION_THRESHOLD_MS)) {
            // Case A: Create NEW version
            activeVersionId = generateId();
            await tx.insert(schema.noteVersions).values({
                id: activeVersionId,
                noteId,
                content: normalizedContent,
                createdAt: now,
            }).run();

            // Enforce Limit (cleanup old versions)
            const versions = await tx.select({ id: schema.noteVersions.id }).from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, noteId))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            if (versions.length > MAX_VERSIONS) {
                const versionsToDelete = versions.slice(MAX_VERSIONS).map((v: { id: string }) => v.id);
                if (versionsToDelete.length > 0) {
                    // Detach images from deleted versions
                    await ImagesRepo.deleteImagesForVersions(versionsToDelete, tx);

                    await tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, versionsToDelete))
                        .run();
                }
            }
        } else {
            // Case B: Update EXISTING latest version (debounce)
            activeVersionId = latestVersion.id;
            await tx.update(schema.noteVersions)
                .set({ content: normalizedContent, createdAt: now })
                .where(eq(schema.noteVersions.id, latestVersion.id))
                .run();
        }

        // 4. Sync images to active version
        await ImagesRepo.setImagesForVersion(activeVersionId, imageIds, tx);

        // 5. Garbage Collection: Delete images not referenced by ANY version
        const deletedFilePaths = await ImagesRepo.deleteUnreferencedImages(tx);

        // Clean up files (best effort)
        for (const path of deletedFilePaths) {
            await deleteImageFile(path);
        }
    });
}

/**
 * Normalizes all stored note/version content so image nodes with `data-image-id`
 * don't carry inline `src` payloads in SQLite.
 * Returns number of rows updated across both tables.
 */
export async function normalizeAllStoredContent(): Promise<number> {
    let updatedRows = 0;

    await getDb().transaction(async (tx: DbOrTx) => {
        const notes = await tx
            .select({ id: schema.noteContent.id, content: schema.noteContent.content })
            .from(schema.noteContent)
            .all();

        for (const note of notes) {
            const normalized = normalizeStoredContent(note.content);
            if (normalized === note.content) continue;

            await tx.update(schema.noteContent)
                .set({ content: normalized })
                .where(eq(schema.noteContent.id, note.id))
                .run();
            updatedRows++;
        }

        const versions = await tx
            .select({ id: schema.noteVersions.id, content: schema.noteVersions.content })
            .from(schema.noteVersions)
            .all();

        for (const version of versions) {
            const normalized = normalizeStoredContent(version.content);
            if (normalized === version.content) continue;

            await tx.update(schema.noteVersions)
                .set({ content: normalized })
                .where(eq(schema.noteVersions.id, version.id))
                .run();
            updatedRows++;
        }
    });

    return updatedRows;
}

// ============ VERSION OPERATIONS ============

export async function getNoteVersions(noteId: string): Promise<{ id: string; createdAt: Date }[]> {
    return await getDb()
        .select({
            id: schema.noteVersions.id,
            createdAt: schema.noteVersions.createdAt
        })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.noteId, noteId))
        .orderBy(desc(schema.noteVersions.createdAt))
        .all();
}

export async function getNoteVersion(versionId: string) {
    const version = await getDb()
        .select()
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .get();

    if (!version) return version;

    const normalized = normalizeStoredContent(version.content);
    if (normalized !== version.content) {
        await getDb().update(schema.noteVersions)
            .set({ content: normalized })
            .where(eq(schema.noteVersions.id, versionId))
            .run();
        return { ...version, content: normalized };
    }

    return version;
}

export async function deleteNoteVersion(versionId: string): Promise<void> {
    await getDb().delete(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .run();
}

export async function deleteAllNoteVersionsExceptLatest(noteId: string): Promise<void> {
    const versions = await getDb()
        .select({ id: schema.noteVersions.id })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.noteId, noteId))
        .orderBy(desc(schema.noteVersions.createdAt))
        .all();

    if (versions.length <= 1) return;

    const versionsToDelete = versions.slice(1).map((v: { id: string }) => v.id);

    await getDb().transaction(async (tx: DbOrTx) => {
        await ImagesRepo.deleteImagesForVersions(versionsToDelete, tx);
        await tx.delete(schema.noteVersions)
            .where(inArray(schema.noteVersions.id, versionsToDelete))
            .run();

        const deletedFilePaths = await ImagesRepo.deleteUnreferencedImages(tx);
        for (const path of deletedFilePaths) {
            await deleteImageFile(path);
        }
    });
}

export async function getRecentNotes(limitCount: number = 5): Promise<NoteMetadata[]> {
    return await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .orderBy(desc(schema.noteMetadata.updatedAt))
        .limit(limitCount)
        .all();
}

// ============ BULK OPERATIONS (for Folder Service Cascading) ============

export async function permanentlyDeleteNotesInFolders(folderIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (folderIds.length === 0) return;

    // We defer all deletions to allow the full object to sync as a tombstone
    await tx.update(schema.noteMetadata)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(inArray(schema.noteMetadata.folderId, folderIds))
        .run();
}

export async function softDeleteNotesInFolders(folderIds: string[], now: Date, tx: DbOrTx = getDb()): Promise<void> {
    if (folderIds.length === 0) return;

    await tx.update(schema.noteMetadata)
        .set({
            isDeleted: true,
            deletedAt: now,
            originalFolderId: sql`${schema.noteMetadata.folderId}`, // Snapshot current folder as original
            folderId: 'system-trash',
            updatedAt: now,
        })
        .where(inArray(schema.noteMetadata.folderId, folderIds))
        .run();
}
// restore notes in folders - called from folders.service.ts when restoring a folder
// only restore notes that were not deleted before the folder was deleted
export async function restoreNotesInFolders(folderIds: string[], folderDeletedAt: Date, tx: DbOrTx = getDb()): Promise<void> {
    if (folderIds.length === 0) return;

    await tx.update(schema.noteMetadata)
        .set({
            isDeleted: false,
            deletedAt: null,
            folderId: sql`${schema.noteMetadata.originalFolderId}`, // Restore from original
            originalFolderId: null,
        })
        .where(and(gte(schema.noteMetadata.deletedAt, folderDeletedAt),
            inArray(schema.noteMetadata.originalFolderId, folderIds))) // Matches based on where they CAME from
        .run();
}

export async function permanentlyDeleteDeletedNotes(tx: DbOrTx = getDb()): Promise<void> {
    // We defer all deletions to allow the full object to sync as a tombstone
    await tx.update(schema.noteMetadata)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.noteMetadata.isDeleted, true))
        .run();
}

export async function getNoteIdsByOriginalFolderIds(folderIds: string[], folderDeletedAt: Date): Promise<string[]> {
    if (folderIds.length === 0) return [];

    const results = await getDb().select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(and(
            gte(schema.noteMetadata.deletedAt, folderDeletedAt),
            inArray(schema.noteMetadata.originalFolderId, folderIds)
        ))
        .all();

    return results.map((r: { id: string }) => r.id);
}

export async function getDeletedNoteIds(tx: DbOrTx = getDb()): Promise<string[]> {
    const results = await tx.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, true))
        .all();
    return results.map((r: { id: string }) => r.id);
}

export async function getNotesCount(tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx.select({ count: sql<number>`count(*)` })
        .from(schema.noteMetadata)
        .where(and(eq(schema.noteMetadata.isDeleted, false), eq(schema.noteMetadata.isPermDeleted, false)))
        .get();
    return result?.count ?? 0;
}
