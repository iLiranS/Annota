import { deleteImageFile } from '@/lib/services/images/image.service';
import { getDb } from '@/lib/stores/db.store';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import crypto from 'react-native-quick-crypto';
import { DbOrTx, schema } from '../client';
import type { NoteMetadata, NoteMetadataInsert } from '../schema';
import * as ImagesRepo from './images.repository';

// Re-export types for convenience
export type { NoteMetadata, NoteVersion } from '../schema';

function normalizeStoredContent(content: string): string {
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
    return Array.from(content.matchAll(/data-image-id=['"]([^'"]+)['"]/g), (match) => match[1]);
}






// ============ SYNC OPERATIONS ============

export function getDirtyNotes(): NoteMetadata[] {
    return getDb().select().from(schema.noteMetadata).where(eq(schema.noteMetadata.isDirty, true)).all();
}

export function clearDirtyNotes(noteIds: string[], syncedAt: Date): void {
    if (noteIds.length === 0) return;
    getDb().update(schema.noteMetadata)
        .set({ isDirty: false, lastSyncedAt: syncedAt })
        .where(inArray(schema.noteMetadata.id, noteIds))
        .run();
}

export function upsertSyncedNote(noteFullData: any, tx: DbOrTx = getDb()): void {
    const content = normalizeStoredContent(noteFullData.content || '');
    const metadataDetails = { ...noteFullData };
    delete metadataDetails.content; // The rest is metadata

    // Insert or Update Metadata
    tx.insert(schema.noteMetadata)
        .values(metadataDetails)
        .onConflictDoUpdate({ target: schema.noteMetadata.id, set: metadataDetails })
        .run();

    // Insert or Update Content (Heavy Data)
    tx.insert(schema.noteContent)
        .values({ id: metadataDetails.id, content })
        .onConflictDoUpdate({ target: schema.noteContent.id, set: { content } })
        .run();

    const noteUpdatedAt = metadataDetails.updatedAt instanceof Date ? metadataDetails.updatedAt : new Date();
    const imageIds = extractImageIdsFromContent(content);
    const MAX_VERSIONS = 50;

    // Keep the synced note represented by a local version so image links are not orphaned.
    const latestVersion = tx.select({
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
        activeVersionId = crypto.randomUUID();
        tx.insert(schema.noteVersions).values({
            id: activeVersionId,
            noteId: metadataDetails.id,
            content,
            createdAt: noteUpdatedAt,
        }).run();
    } else {
        const latestNormalizedContent = normalizeStoredContent(latestVersion.content);
        if (latestNormalizedContent !== latestVersion.content) {
            tx.update(schema.noteVersions)
                .set({ content: latestNormalizedContent })
                .where(eq(schema.noteVersions.id, latestVersion.id))
                .run();
        }

        if (latestNormalizedContent === content) {
            activeVersionId = latestVersion.id;
        } else {
            activeVersionId = crypto.randomUUID();
            tx.insert(schema.noteVersions).values({
                id: activeVersionId,
                noteId: metadataDetails.id,
                content,
                createdAt: noteUpdatedAt,
            }).run();

            const versions = tx.select({ id: schema.noteVersions.id })
                .from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, metadataDetails.id))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            if (versions.length > MAX_VERSIONS) {
                const versionsToDelete = versions.slice(MAX_VERSIONS).map(v => v.id);
                if (versionsToDelete.length > 0) {
                    ImagesRepo.deleteImagesForVersions(versionsToDelete, tx);
                    tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, versionsToDelete))
                        .run();
                }
            }
        }
    }

    ImagesRepo.setImagesForVersion(activeVersionId, imageIds, tx);
}

// ============ METADATA OPERATIONS (fast, for lists) ============

export function getNotesInFolder(folderId: string | null, includeDeleted = false): NoteMetadata[] {
    if (folderId === null) {
        if (includeDeleted) {
            return getDb()
                .select()
                .from(schema.noteMetadata)
                .where(isNull(schema.noteMetadata.folderId))
                .all();
        }
        return getDb()
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
        return getDb()
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.folderId, folderId))
            .all();
    }

    return getDb()
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

export function getNoteMetadataById(noteId: string): NoteMetadata | null {
    const result = getDb()
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.id, noteId))
        .get();

    return result ?? null;
}

export function createNoteMetadata(metadata: NoteMetadataInsert): NoteMetadata {
    // 2. Run as a TRANSACTION (All or Nothing)
    return getDb().transaction((tx) => {
        // A. Insert Metadata
        const insertedNote = tx.insert(schema.noteMetadata)
            .values(metadata)
            .returning()
            .get();

        // B. Insert Empty Content
        tx.insert(schema.noteContent).values({
            id: metadata.id,
            content: '',
        }).run();

        return insertedNote;
    });
}
export function updateNoteMetadata(noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>): NoteMetadata {
    const noteMetadata = getDb()
        .update(schema.noteMetadata)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.noteMetadata.id, noteId))
        .returning()
        .get();
    return noteMetadata
}


export function softDeleteNote(noteId: string): void {
    const note = getNoteMetadataById(noteId);
    if (!note) return;

    const now = new Date();
    getDb()
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

export function restoreNote(noteId: string, targetFolderId?: string | null): void {
    const note = getNoteMetadataById(noteId);
    if (!note) return;

    const now = new Date();

    // Determine restore location
    let restoredFolderId: string | null = null;
    if (targetFolderId !== undefined) {
        restoredFolderId = targetFolderId;
    } else if (note.originalFolderId) {
        // Check if original folder exists and is not deleted
        const originalFolder = getDb()
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.id, note.originalFolderId))
            .get();

        if (originalFolder && !originalFolder.isDeleted) {
            restoredFolderId = note.originalFolderId;
        }
        // If original folder is deleted or doesn't exist, restore to root (null)
    }

    getDb()
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

export function permanentlyDeleteNote(noteId: string): void {
    getDb().transaction((tx) => {
        // We defer all deletions to allow the full object to sync as a tombstone
        tx.update(schema.noteMetadata)
            .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
            .where(eq(schema.noteMetadata.id, noteId))
            .run();
    });
}

export function getQuickAccessNotes(): NoteMetadata[] {
    return getDb()
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

export function getPinnedNotesInFolder(folderId: string): NoteMetadata[] {
    return getDb()
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

export function getDeletedNotes(): NoteMetadata[] {
    return getDb()
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

export function getNoteContent(noteId: string): string {
    const result = getDb()
        .select()
        .from(schema.noteContent)
        .where(eq(schema.noteContent.id, noteId))
        .get();

    const rawContent = result?.content ?? '';
    const normalized = normalizeStoredContent(rawContent);

    // Self-heal previously stored rows that lost src attribute.
    if (result && normalized !== rawContent) {
        getDb().update(schema.noteContent)
            .set({ content: normalized })
            .where(eq(schema.noteContent.id, noteId))
            .run();
    }

    return normalized;
}

export function updateNoteContent(noteId: string, content: string, preview: string): void {
    const now = new Date();
    const VERSION_THRESHOLD_MS = 10000; // 10 seconds
    const MAX_VERSIONS = 50;
    const normalizedContent = normalizeStoredContent(content);

    // Extract image IDs from canonical content
    const imageIds = extractImageIdsFromContent(normalizedContent);

    // 1. Update current content (Always)
    getDb().transaction((tx) => {
        tx.update(schema.noteContent)
            .set({ content: normalizedContent })
            .where(eq(schema.noteContent.id, noteId))
            .run();

        // 2. Update preview in metadata
        tx.update(schema.noteMetadata)
            .set({ preview, updatedAt: now })
            .where(eq(schema.noteMetadata.id, noteId))
            .run();

        // 3. Handle Versioning
        // Get latest version
        const latestVersion = tx.select()
            .from(schema.noteVersions)
            .where(eq(schema.noteVersions.noteId, noteId))
            .orderBy(desc(schema.noteVersions.createdAt))
            .limit(1)
            .get();

        let activeVersionId: string;

        if (!latestVersion || (now.getTime() - latestVersion.createdAt.getTime() > VERSION_THRESHOLD_MS)) {
            // Case A: Create NEW version
            activeVersionId = crypto.randomUUID();
            tx.insert(schema.noteVersions).values({
                id: activeVersionId,
                noteId,
                content: normalizedContent,
                createdAt: now,
            }).run();

            // Enforce Limit (cleanup old versions)
            const versions = tx.select({ id: schema.noteVersions.id }).from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, noteId))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            if (versions.length > MAX_VERSIONS) {
                const versionsToDelete = versions.slice(MAX_VERSIONS).map(v => v.id);
                if (versionsToDelete.length > 0) {
                    // Detach images from deleted versions
                    ImagesRepo.deleteImagesForVersions(versionsToDelete, tx);

                    tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, versionsToDelete))
                        .run();
                }
            }
        } else {
            // Case B: Update EXISTING latest version (debounce)
            activeVersionId = latestVersion.id;
            tx.update(schema.noteVersions)
                .set({ content: normalizedContent, createdAt: now })
                .where(eq(schema.noteVersions.id, latestVersion.id))
                .run();
        }

        // 4. Sync images to active version
        ImagesRepo.setImagesForVersion(activeVersionId, imageIds, tx);

        // 5. Garbage Collection: Delete images not referenced by ANY version
        const deletedFilePaths = ImagesRepo.deleteUnreferencedImages(tx);

        // Clean up files (best effort)
        for (const path of deletedFilePaths) {
            deleteImageFile(path);
        }
    });
}

/**
 * Normalizes all stored note/version content so image nodes with `data-image-id`
 * don't carry inline `src` payloads in SQLite.
 * Returns number of rows updated across both tables.
 */
export function normalizeAllStoredContent(): number {
    let updatedRows = 0;

    getDb().transaction((tx) => {
        const notes = tx
            .select({ id: schema.noteContent.id, content: schema.noteContent.content })
            .from(schema.noteContent)
            .all();

        for (const note of notes) {
            const normalized = normalizeStoredContent(note.content);
            if (normalized === note.content) continue;

            tx.update(schema.noteContent)
                .set({ content: normalized })
                .where(eq(schema.noteContent.id, note.id))
                .run();
            updatedRows++;
        }

        const versions = tx
            .select({ id: schema.noteVersions.id, content: schema.noteVersions.content })
            .from(schema.noteVersions)
            .all();

        for (const version of versions) {
            const normalized = normalizeStoredContent(version.content);
            if (normalized === version.content) continue;

            tx.update(schema.noteVersions)
                .set({ content: normalized })
                .where(eq(schema.noteVersions.id, version.id))
                .run();
            updatedRows++;
        }
    });

    return updatedRows;
}

// ============ VERSION OPERATIONS ============

export function getNoteVersions(noteId: string): { id: string; createdAt: Date }[] {
    return getDb()
        .select({
            id: schema.noteVersions.id,
            createdAt: schema.noteVersions.createdAt
        })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.noteId, noteId))
        .orderBy(desc(schema.noteVersions.createdAt))
        .all();
}

export function getNoteVersion(versionId: string) {
    const version = getDb()
        .select()
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .get();

    if (!version) return version;

    const normalized = normalizeStoredContent(version.content);
    if (normalized !== version.content) {
        getDb().update(schema.noteVersions)
            .set({ content: normalized })
            .where(eq(schema.noteVersions.id, versionId))
            .run();
        return { ...version, content: normalized };
    }

    return version;
}

export function deleteNoteVersion(versionId: string): void {
    getDb().delete(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .run();
}

export function getRecentNotes(limitCount: number = 5): NoteMetadata[] {
    return getDb()
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

export function permanentlyDeleteNotesInFolders(folderIds: string[], tx: DbOrTx = getDb()): void {
    if (folderIds.length === 0) return;

    // We defer all deletions to allow the full object to sync as a tombstone
    tx.update(schema.noteMetadata)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(inArray(schema.noteMetadata.folderId, folderIds))
        .run();
}

export function softDeleteNotesInFolders(folderIds: string[], now: Date, tx: DbOrTx = getDb()): void {
    if (folderIds.length === 0) return;

    tx.update(schema.noteMetadata)
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
export function restoreNotesInFolders(folderIds: string[], folderDeletedAt: Date, tx: DbOrTx = getDb()): void {
    if (folderIds.length === 0) return;

    tx.update(schema.noteMetadata)
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

export function permanentlyDeleteDeletedNotes(tx: DbOrTx = getDb()): void {
    // We defer all deletions to allow the full object to sync as a tombstone
    tx.update(schema.noteMetadata)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.noteMetadata.isDeleted, true))
        .run();
}

export function getNoteIdsByOriginalFolderIds(folderIds: string[], folderDeletedAt: Date): string[] {
    if (folderIds.length === 0) return [];

    const results = getDb().select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(and(
            gte(schema.noteMetadata.deletedAt, folderDeletedAt),
            inArray(schema.noteMetadata.originalFolderId, folderIds)
        ))
        .all();

    return results.map(r => r.id);
}

export function getDeletedNoteIds(tx: DbOrTx = getDb()): string[] {
    const results = tx.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, true))
        .all();
    return results.map(r => r.id);
}
