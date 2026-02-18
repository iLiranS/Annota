import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db, DbOrTx, schema } from '../client';
import type { NoteMetadata, NoteMetadataInsert } from '../schema';

// Re-export types for convenience
export type { NoteMetadata, NoteVersion } from '../schema';






// ============ METADATA OPERATIONS (fast, for lists) ============

export function getNotesInFolder(folderId: string | null, includeDeleted = false): NoteMetadata[] {
    if (folderId === null) {
        if (includeDeleted) {
            return db
                .select()
                .from(schema.noteMetadata)
                .where(isNull(schema.noteMetadata.folderId))
                .all();
        }
        return db
            .select()
            .from(schema.noteMetadata)
            .where(
                and(
                    isNull(schema.noteMetadata.folderId),
                    eq(schema.noteMetadata.isDeleted, false)
                )
            )
            .all();
    }

    if (includeDeleted) {
        return db
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.folderId, folderId))
            .all();
    }

    return db
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.folderId, folderId),
                eq(schema.noteMetadata.isDeleted, false)
            )
        )
        .all();
}

export function getNoteMetadataById(noteId: string): NoteMetadata | null {
    const result = db
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.id, noteId))
        .get();

    return result ?? null;
}

export function createNoteMetadata(metadata: NoteMetadataInsert): NoteMetadata {
    // 2. Run as a TRANSACTION (All or Nothing)
    return db.transaction((tx) => {
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
    const noteMetadata = db
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
    db
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
        const originalFolder = db
            .select()
            .from(schema.folders)
            .where(eq(schema.folders.id, note.originalFolderId))
            .get();

        if (originalFolder && !originalFolder.isDeleted) {
            restoredFolderId = note.originalFolderId;
        }
        // If original folder is deleted or doesn't exist, restore to root (null)
    }

    db
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
    // Delete content first (foreign key)
    db.delete(schema.noteContent).where(eq(schema.noteContent.id, noteId)).run();
    // Delete versions
    db.delete(schema.noteVersions).where(eq(schema.noteVersions.noteId, noteId)).run();
    // Delete metadata
    db.delete(schema.noteMetadata).where(eq(schema.noteMetadata.id, noteId)).run();
}

export function getQuickAccessNotes(): NoteMetadata[] {
    return db
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.isQuickAccess, true),
                eq(schema.noteMetadata.isDeleted, false)
            )
        )
        .all();
}

export function getPinnedNotesInFolder(folderId: string): NoteMetadata[] {
    return db
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.folderId, folderId),
                eq(schema.noteMetadata.isPinned, true),
                eq(schema.noteMetadata.isDeleted, false)
            )
        )
        .all();
}

export function getDeletedNotes(): NoteMetadata[] {
    return db
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, true))
        .all();
}

// ============ CONTENT OPERATIONS (lazy loaded) ============

export function getNoteContent(noteId: string): string {
    const result = db
        .select()
        .from(schema.noteContent)
        .where(eq(schema.noteContent.id, noteId))
        .get();

    return result?.content ?? '';
}

export function updateNoteContent(noteId: string, content: string, preview: string): void {
    const now = new Date();
    const VERSION_THRESHOLD_MS = 10000; // 10 seconds
    const MAX_VERSIONS = 50;

    // 1. Update current content (Always)
    db.transaction((tx) => {
        tx.update(schema.noteContent)
            .set({ content })
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


        if (!latestVersion || (now.getTime() - latestVersion.createdAt.getTime() > VERSION_THRESHOLD_MS)) {
            // Case A: Create NEW version
            tx.insert(schema.noteVersions).values({
                id: Crypto.randomUUID(), // SQLite doesn't auto-gen UUIDs usually unless configured
                noteId,
                content,
                createdAt: now,
            }).run();

            // Enforce Limit (cleanup old versions)
            // We can do a count check or just delete subquery
            // For SQLite + Drizzle, let's just fetch IDs to delete if count is high
            // Optimization: Only check every N updates or just do it.
            // Let's use a subquery delete for robustness if possible, or filtered delete.
            const versions = tx.select({ id: schema.noteVersions.id }).from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, noteId))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            if (versions.length > MAX_VERSIONS) {
                const idsToDelete = versions.slice(MAX_VERSIONS).map(v => v.id);
                if (idsToDelete.length > 0) {
                    tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, idsToDelete))
                        .run();
                }
            }

        } else {
            // Case B: Update EXISTING latest version (debounce)
            // This keeps the "latest work session" updated without spamming versions
            tx.update(schema.noteVersions)
                .set({ content, createdAt: now }) // Optionally update createdAt to bump it? Or keep start time of session?
                // User requirement: "not updated on every little change - only if the timestamp from previous update is like at least 10-20 seconds"
                // If we update createdAt, we theoretically extend the session indefinitely if they keep typing.
                // If we DON'T update createdAt, the gap will eventually exceed 10s and force a new version.
                // "Session" extending seems more natural for "Version History" (grouping edits).
                // Let's update createdAt so as long as they type, it's one version.
                .where(eq(schema.noteVersions.id, latestVersion.id))
                .run();
        }
    });
}

// ============ VERSION OPERATIONS ============

export function getNoteVersions(noteId: string): { id: string; createdAt: Date }[] {
    return db
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
    return db
        .select()
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .get();
}

export function getRecentNotes(limitCount: number = 5): NoteMetadata[] {
    return db
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, false))
        .orderBy(desc(schema.noteMetadata.updatedAt))
        .limit(limitCount)
        .all();
}

// ============ BULK OPERATIONS (for Folder Service Cascading) ============

export function permanentlyDeleteNotesInFolders(folderIds: string[], tx: DbOrTx = db): void {
    if (folderIds.length === 0) return;

    // 1. Get note IDs to delete content/versions (we need subqueries or separate fetch)
    // SQLite doesn't support DELETE ... WHERE .. IN (SELECT ..) with strict ordering easily in Drizzle without raw SQL sometimes,
    // but Drizzle's delete(..).where(inArray(..)) is standard.

    // Using subquery for deletion in SQLite with Drizzle:
    const notesInFolders = tx.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(inArray(schema.noteMetadata.folderId, folderIds));

    // 1. Delete content
    tx.delete(schema.noteContent)
        .where(inArray(schema.noteContent.id, notesInFolders))
        .run();

    // 2. Delete versions
    tx.delete(schema.noteVersions)
        .where(inArray(schema.noteVersions.noteId, notesInFolders))
        .run();

    // 3. Delete metadata
    tx.delete(schema.noteMetadata)
        .where(inArray(schema.noteMetadata.folderId, folderIds))
        .run();
}

export function softDeleteNotesInFolders(folderIds: string[], now: Date, tx: DbOrTx = db): void {
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
export function restoreNotesInFolders(folderIds: string[], folderDeletedAt: Date, tx: DbOrTx = db): void {
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

export function permanentlyDeleteDeletedNotes(tx: DbOrTx = db): void {
    const deletedNotes = tx.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, true));

    // 1. Delete content
    tx.delete(schema.noteContent)
        .where(inArray(schema.noteContent.id, deletedNotes))
        .run();

    // 2. Delete versions
    tx.delete(schema.noteVersions)
        .where(inArray(schema.noteVersions.noteId, deletedNotes))
        .run();

    // 3. Delete metadata
    tx.delete(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, true))
        .run();
}

export function getNoteIdsByOriginalFolderIds(folderIds: string[], folderDeletedAt: Date): string[] {
    if (folderIds.length === 0) return [];

    const results = db.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(and(
            gte(schema.noteMetadata.deletedAt, folderDeletedAt),
            inArray(schema.noteMetadata.originalFolderId, folderIds)
        ))
        .all();

    return results.map(r => r.id);
}