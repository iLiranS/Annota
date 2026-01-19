import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../client';
import type { NoteMetadata, NoteMetadataInsert } from '../schema';

// Re-export types for convenience
export type { NoteMetadata } from '../schema';

// Helper to generate unique IDs
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to generate preview from HTML content
function generatePreview(htmlContent: string, maxLength = 100): string {
    // Strip HTML tags and get plain text
    const plainText = htmlContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (plainText.length <= maxLength) {
        return plainText;
    }

    return plainText.substring(0, maxLength).trim() + '...';
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
    const id = generateId();

    const noteData: NoteMetadataInsert = {
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
        tags: '[]',
        originalFolderId: null,
    };

    // Insert metadata
    db.insert(schema.noteMetadata).values(noteData).run();

    // Also create empty content row
    db.insert(schema.noteContent).values({
        noteId: id,
        content: '',
    }).run();

    // Return the created note
    return db
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.id, id))
        .get()!;
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
