import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db, DbOrTx, schema } from '../client';
import type { NoteMetadata } from '../schema';

// Re-export types for convenience
export type { NoteMetadata } from '../schema';

// Helper to generate unique IDs
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to generate preview from HTML content
function generatePreview(htmlContent: string, maxLength = 100): string {
    const lines = htmlContent
        .split(/<br\s*\/?>|<\/p>|<\/div>|<\/h[1-6]>|\n/i)
        .map(line => line.replace(/<[^>]*>/g, '').trim())
        .filter(line => line.length > 0);

    const secondLine = lines[1] || '';

    if (secondLine.length <= maxLength) {
        return secondLine;
    }

    return secondLine.substring(0, maxLength).trim() + '...';
}

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

export function createNoteMetadata(folderId: string | null): NoteMetadata {
    const now = new Date();
    const id = generateId(); // e.g. UUID

    // 1. Construct the object in memory first
    const noteData: NoteMetadata = {
        id,
        folderId,
        title: 'Untitled Note',
        preview: '',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
        isPinned: false,
        isQuickAccess: false,
        tags: '[]', // Drizzle usually handles JSON parsing/stringifying automatically if defined in schema
        originalFolderId: null,
    };

    // 2. Run as a TRANSACTION (All or Nothing)
    db.transaction(() => {
        // A. Insert Metadata
        db.insert(schema.noteMetadata).values(noteData).run();

        // B. Insert Empty Content
        db.insert(schema.noteContent).values({
            noteId: id,
            content: '',
        }).run();
    });

    return noteData;
}

export function updateNoteMetadata(
    noteId: string,
    updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>
): void {
    db
        .update(schema.noteMetadata)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.noteMetadata.id, noteId))
        .run();
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
    db.delete(schema.noteContent).where(eq(schema.noteContent.noteId, noteId)).run();
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
        .where(eq(schema.noteContent.noteId, noteId))
        .get();

    return result?.content ?? '';
}

export function updateNoteContent(noteId: string, content: string): void {
    const preview = generatePreview(content);

    // Update content
    db
        .update(schema.noteContent)
        .set({ content })
        .where(eq(schema.noteContent.noteId, noteId))
        .run();

    // Update preview in metadata
    db
        .update(schema.noteMetadata)
        .set({ preview, updatedAt: new Date() })
        .where(eq(schema.noteMetadata.id, noteId))
        .run();
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
        .where(inArray(schema.noteContent.noteId, notesInFolders))
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
        .where(inArray(schema.noteContent.noteId, deletedNotes))
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