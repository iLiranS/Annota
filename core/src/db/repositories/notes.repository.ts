import { and, desc, eq, getTableColumns, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { deleteFile } from '../../services/files/file.service';
import { getDb } from '../../stores/db.store';
import { generateId } from '../../utils/id';
import type { NoteMetadata, NoteMetadataInsert } from '../schema';
import * as schema from '../schema';
import type { DbOrTx } from '../types';
import { safeGet, safeGetAll } from '../utils';
import * as FilesRepo from './files.repository';
import { parsePendingTasks, type PendingTask } from './search.repository';
import { latestVersionCache, noteLinksCache, noteFilesCache } from '../../utils/caches';

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

interface ExtractedLink {
    targetId: string;
    blockId: string | null;
    fullUrl: string;
}

function extractLinks(content: string): ExtractedLink[] {
    if (!content) return [];
    const linkRegex = /href=["'](annota:\/\/note\/([a-zA-Z0-9-]+)(?:\?blockId=([a-zA-Z0-9-]+))?)["']/gi;
    const linksMap = new Map<string, ExtractedLink>();

    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        const fullUrl = match[1];
        const targetId = match[2];
        const blockId = match[3] || null;

        if (!linksMap.has(targetId)) {
            linksMap.set(targetId, { targetId, blockId, fullUrl });
        }
    }
    return Array.from(linksMap.values()).sort((a, b) => a.targetId.localeCompare(b.targetId));
}

// Re-export types for convenience
export type { NoteMetadata, NoteVersion } from '../schema';

export const MAX_NOTE_SIZE = 145000;
export const MAX_CONTENT_SIZE = MAX_NOTE_SIZE; // Deprecated, keep for compat if needed, otherwise use MAX_NOTE_SIZE everywhere
export function normalizeStoredContent(content: string): string {
    if (!content) return content ?? '';

    // 1. Handle legacy image nodes: Keep data-image-id, strip heavy base64 src
    let normalized = content.replace(/<img\b[^>]*>/gi, (imgTag) => {
        if (!/data-image-id\s*=\s*["'][^"']+["']/i.test(imgTag)) {
            return imgTag;
        }

        let tag = imgTag
            .replace(/\s+src\s*=\s*(["']).*?\1/gi, ' src=""')
            .replace(/\s+src\s*=\s*[^\s>]+/gi, ' src=""');

        if (!/\s+src\s*=/i.test(tag)) {
            tag = tag.replace(/\s*\/?>$/, (end) => ` src=""${end}`);
        }

        return tag;
    });

    // 2. Handle file-attachment nodes (already clean, but ensure consistency if needed)
    // No heavy payload stripping needed for now as they don't use src.

    return normalized;
}

/**
 * Extracts all file IDs (images or general attachments) from the HTML content.
 * Searches for data-image-id (legacy) and fileId/file-id (new).
 */
function extractFileIdsFromContent(content: string): string[] {
    const ids = new Set<string>();

    // Legacy image IDs: data-image-id="..."
    const imageIdRegex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    let match;
    while ((match = imageIdRegex.exec(content)) !== null) {
        ids.add(match[2]);
    }

    // New file attachment IDs: fileId="..." or file-id="..."
    const fileIdRegex = /(?:fileid|file-id)\s*=\s*(["'])(.*?)\1/gi;
    while ((match = fileIdRegex.exec(content)) !== null) {
        ids.add(match[2]);
    }

    return Array.from(ids);
}




// ============ SYNC OPERATIONS ============

/**
 * Parses note content to find internal links and updates the note_links table.
 */
async function updateNoteLinks(sourceId: string, links: ExtractedLink[], tx: DbOrTx): Promise<void> {
    // 1. Delete existing links where this note is the source
    await tx.delete(schema.noteLinks).where(eq(schema.noteLinks.sourceId, sourceId)).run();

    // 2. Filter out self-links
    const filteredLinks = links.filter(l => l.targetId !== sourceId);

    // 3. Insert new links
    if (filteredLinks.length > 0) {
        const newLinks = filteredLinks.map((link) => ({
            sourceId,
            targetId: link.targetId,
            blockId: link.blockId,
        }));

        await tx.insert(schema.noteLinks)
            .values(newLinks)
            .onConflictDoNothing({ target: [schema.noteLinks.sourceId, schema.noteLinks.targetId] })
            .run();
    }
}

/**
 * Parses note content to find pending tasks and updates the note_tasks table.
 */
export async function updateNoteTasks(noteId: string, content: string, tx: DbOrTx, parsedTasks?: PendingTask[]): Promise<void> {
    // 1. Delete existing tasks where this note is the source
    await tx.delete(schema.noteTasks).where(eq(schema.noteTasks.noteId, noteId)).run();

    // 2. Extract tasks using parsePendingTasks or use pre-parsed tasks
    const tasks = parsedTasks ?? parsePendingTasks(content);

    // 3. Insert new tasks
    if (tasks.length > 0) {
        const newTasks = tasks.map((task) => ({
            noteId,
            taskIndex: task.index,
            text: task.text,
        }));

        await tx.insert(schema.noteTasks)
            .values(newTasks)
            .onConflictDoNothing({ target: [schema.noteTasks.noteId, schema.noteTasks.taskIndex] })
            .run();
    }
}


export async function getDirtyNotes(): Promise<NoteMetadata[]> {
    const result = await getDb().select().from(schema.noteMetadata).where(eq(schema.noteMetadata.isDirty, true)).all();
    return safeGetAll<NoteMetadata>(result);
}

export async function clearDirtyNotes(noteIds: string[]): Promise<void> {
    if (noteIds.length === 0) return;
    await getDb().update(schema.noteMetadata)
        .set({ isDirty: false })
        .where(inArray(schema.noteMetadata.id, noteIds))
        .run();
}

export async function upsertSyncedNote(noteFullData: any, tx: DbOrTx = getDb()): Promise<string[]> {
    const id = noteFullData.id;
    if (!id) {
        console.error('[Sync] Cannot upsert note: missing ID', noteFullData);
        return [];
    }
    latestVersionCache.delete(id);
    noteLinksCache.delete(id);
    noteFilesCache.delete(id);
    const hyphenlessId = id.replace(/-/g, '');

    // 1. Find existing by Hyphenated or Hyphenless
    const result = await tx.select().from(schema.noteMetadata)
        .where(or(
            eq(schema.noteMetadata.id, id),
            eq(schema.noteMetadata.id, hyphenlessId)
        ))
        .get();

    const existing = safeGet<NoteMetadata>(result);

    if (existing) {
        if (existing.updatedAt > noteFullData.updatedAt) {
            console.log(`[Sync] Local note ${id} is newer, ignoring pulled row.`);
            return [];
        }

        // 2. MIGRATION: Upgrade ID and references in noteContent and noteVersions
        if (existing.id === hyphenlessId && id !== hyphenlessId) {
            console.log(`[Sync] Migrating legacy Note ID and content link: ${hyphenlessId} -> ${id}`);

            // Update Note Metadata ID
            await tx.update(schema.noteMetadata).set({ id }).where(eq(schema.noteMetadata.id, hyphenlessId)).run();
            // Update Note Content ID
            await tx.update(schema.noteContent).set({ id }).where(eq(schema.noteContent.id, hyphenlessId)).run();
            // Update Note Versions noteId
            await tx.update(schema.noteVersions).set({ noteId: id }).where(eq(schema.noteVersions.noteId, hyphenlessId)).run();
        }
    }

    const content = normalizeStoredContent(noteFullData.content || '');
    const fileIds = extractFileIdsFromContent(content);
    const metadataDetails = {
        ...noteFullData,
        lastSyncedFileIds: JSON.stringify(fileIds),
    };
    delete metadataDetails.content; // The rest is metadata

    // 3. Perform standard upsert on Metadata
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

    const safeLatestVersion = safeGet<{ id: string; content: string }>(latestVersion);

    // Compare new file IDs against the previous local version's file IDs to determine
    // if the file set has changed. Used by the pull sync to skip getUserFileLinks
    // when nothing has changed.
    let filesChanged: boolean;
    if (!safeLatestVersion || !safeLatestVersion.id) {
        // Brand-new note — no baseline to compare, must treat as changed
        filesChanged = fileIds.length > 0;
    } else {
        const previousFileIds = await FilesRepo.getFileIdsForVersions([safeLatestVersion.id], tx);
        const newSorted = [...fileIds].sort();
        const prevSorted = [...previousFileIds].sort();
        filesChanged = newSorted.length !== prevSorted.length ||
            newSorted.some((id, i) => id !== prevSorted[i]);
    }

    let activeVersionId: string;

    if (!safeLatestVersion || !safeLatestVersion.id) {
        const inserted = await tx.insert(schema.noteVersions).values({
            id: generateId(),
            noteId: metadataDetails.id,
            content,
            createdAt: noteUpdatedAt,
        }).returning().get();
        activeVersionId = safeGet<any>(inserted)!.id;
    } else {
        const latestNormalizedContent = normalizeStoredContent(safeLatestVersion.content);
        if (latestNormalizedContent !== safeLatestVersion.content) {
            await tx.update(schema.noteVersions)
                .set({ content: latestNormalizedContent })
                .where(eq(schema.noteVersions.id, safeLatestVersion.id))
                .run();
        }

        if (latestNormalizedContent === content) {
            activeVersionId = safeLatestVersion.id;
        } else {
            const inserted = await tx.insert(schema.noteVersions).values({
                id: generateId(),
                noteId: metadataDetails.id,
                content,
                createdAt: noteUpdatedAt,
            }).returning().get();
            activeVersionId = safeGet<any>(inserted)!.id;

            const versions = await tx.select({ id: schema.noteVersions.id })
                .from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, metadataDetails.id))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            const safeVersions = safeGetAll<{ id: string }>(versions);

            if (safeVersions.length > MAX_VERSIONS) {
                const versionsToDelete = safeVersions.slice(MAX_VERSIONS).map(v => v.id);
                if (versionsToDelete.length > 0) {
                    await FilesRepo.deleteFilesForVersions(versionsToDelete, tx);
                    await tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, versionsToDelete))
                        .run();
                }
            }
        }
    }

    await FilesRepo.setFilesForVersion(activeVersionId, fileIds, tx);
    await updateNoteLinks(metadataDetails.id, extractLinks(content), tx);
    await updateNoteTasks(metadataDetails.id, content, tx);

    // Return the new file IDs only if they differ from the previous local version,
    // so the caller can skip cloud file-link queries for unchanged notes.
    return filesChanged ? fileIds : [];

}

// ============ METADATA OPERATIONS (fast, for lists) ============

export async function getNotesInFolder(folderId: string | null, includeDeleted = false): Promise<NoteMetadata[]> {
    if (folderId === null) {
        if (includeDeleted) {
            const result = await getDb()
                .select()
                .from(schema.noteMetadata)
                .where(isNull(schema.noteMetadata.folderId))
                .all();
            return safeGetAll<NoteMetadata>(result);
        }
        const result2 = await getDb()
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
        return safeGetAll<NoteMetadata>(result2);
    }

    if (includeDeleted) {
        const result = await getDb()
            .select()
            .from(schema.noteMetadata)
            .where(eq(schema.noteMetadata.folderId, folderId))
            .all();
        return safeGetAll<NoteMetadata>(result);
    }

    const result3 = await getDb()
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
    return safeGetAll<NoteMetadata>(result3);
}

export async function getNoteByFolderAndDate(folderId: string, date: Date): Promise<NoteMetadata | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.folderId, folderId),
                gte(schema.noteMetadata.createdAt, startOfDay),
                lte(schema.noteMetadata.createdAt, endOfDay),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        ).limit(1).get();

    return safeGet<NoteMetadata>(result);
}

export async function getNoteMetadataById(noteId: string): Promise<NoteMetadata | null> {
    const result = await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.id, noteId))
        .get();

    return safeGet<NoteMetadata>(result);
}

export async function createNoteMetadata(metadata: NoteMetadataInsert): Promise<NoteMetadata> {
    // 2. Run as a TRANSACTION (All or Nothing)
    return await getDb().transaction(async (tx: DbOrTx) => {
        // A. Insert Metadata
        const insertedNote = await tx.insert(schema.noteMetadata)
            .values(metadata)
            .returning()
            .get();
        const safeInsertedNote = safeGet<NoteMetadata>(insertedNote);

        // B. Insert Empty Content
        await tx.insert(schema.noteContent).values({
            id: metadata.id,
            content: '',
        }).run();

        return safeInsertedNote!;
    });
}

export async function createNotesBulk(notes: { metadata: NoteMetadataInsert, content: string }[]): Promise<NoteMetadata[]> {
    return await getDb().transaction(async (tx: DbOrTx) => {
        const result: NoteMetadata[] = [];

        for (const item of notes) {
            const normalized = normalizeStoredContent(item.content);
            const byteSize = new TextEncoder().encode(normalized).length;
            if (byteSize > MAX_NOTE_SIZE) {
                console.warn(`[Repo] Skipping note "${item.metadata.title}" due to size: ${byteSize} bytes`);
                continue;
            }

            // A. Insert Metadata
            const insertedNote = await tx.insert(schema.noteMetadata)
                .values(item.metadata)
                .returning()
                .get();
            const safeInsertedNote = safeGet<NoteMetadata>(insertedNote);

            if (safeInsertedNote) {
                // B. Insert Content
                await tx.insert(schema.noteContent).values({
                    id: safeInsertedNote.id,
                    content: normalized,
                }).run();

                result.push(safeInsertedNote);
            }
        }

        return result;
    });
}

export async function updateNoteMetadata(noteId: string, updates: Partial<Omit<NoteMetadata, 'id' | 'createdAt'>>): Promise<NoteMetadata> {
    const now = new Date();
    // When publishUpdatedAt is being set, ensure it shares the exact same timestamp
    // as updatedAt so the sync engine can detect explicit publish actions.
    const finalUpdates = {
        ...updates,
        updatedAt: now,
        ...(updates.publishUpdatedAt !== undefined && updates.publishUpdatedAt !== null ? { publishUpdatedAt: now } : {}),
    };
    const noteMetadata = await getDb()
        .update(schema.noteMetadata)
        .set(finalUpdates)
        .where(eq(schema.noteMetadata.id, noteId))
        .returning()
        .get();
    const safeNoteMetadata = safeGet<NoteMetadata>(noteMetadata);
    return safeNoteMetadata!;
}


export async function softDeleteNote(noteId: string): Promise<void> {
    latestVersionCache.delete(noteId);
    noteLinksCache.delete(noteId);
    noteFilesCache.delete(noteId);
    const note = await getNoteMetadataById(noteId);
    console.log(note);
    if (!note) return;

    const now = new Date();
    await getDb()
        .update(schema.noteMetadata)
        .set({
            isDeleted: true,
            deletedAt: now,
            originalFolderId: note.folderId,
            folderId: 'system-trash',
            isDirty: true,
            updatedAt: now,
        })
        .where(eq(schema.noteMetadata.id, noteId))
        .run();
}

export async function bulkSoftDeleteNotes(noteIds: string[]): Promise<void> {
    if (noteIds.length === 0) return;
    for (const noteId of noteIds) {
        latestVersionCache.delete(noteId);
        noteLinksCache.delete(noteId);
        noteFilesCache.delete(noteId);
    }
    const now = new Date();
    await getDb()
        .update(schema.noteMetadata)
        .set({
            isDeleted: true,
            deletedAt: now,
            originalFolderId: sql`${schema.noteMetadata.folderId}`,
            folderId: 'system-trash',
            isDirty: true,
            updatedAt: now,
        })
        .where(inArray(schema.noteMetadata.id, noteIds))
        .run();
}

export async function bulkMoveNotes(noteIds: string[], targetFolderId: string | null): Promise<void> {
    if (noteIds.length === 0) return;
    const now = new Date();
    const normalizedFolderId = (targetFolderId === 'root' || targetFolderId === '') ? null : targetFolderId;
    await getDb()
        .update(schema.noteMetadata)
        .set({
            folderId: normalizedFolderId,
            isDirty: true,
            updatedAt: now,
        })
        .where(inArray(schema.noteMetadata.id, noteIds))
        .run();
}

export async function restoreNote(noteId: string, targetFolderId?: string | null): Promise<void> {
    const note = await getNoteMetadataById(noteId);
    if (!note) return;

    const now = new Date();

    // Determine restore location
    let restoredFolderId: string | null = null;
    if (targetFolderId !== undefined) {
        restoredFolderId = (targetFolderId === 'root' || targetFolderId === '') ? null : targetFolderId;
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
            isDirty: true,
            updatedAt: now,
        })
        .where(eq(schema.noteMetadata.id, noteId))
        .run();
}

export async function permanentlyDeleteNote(noteId: string): Promise<void> {
    latestVersionCache.delete(noteId);
    noteLinksCache.delete(noteId);
    noteFilesCache.delete(noteId);
    await getDb().transaction(async (tx: DbOrTx) => {
        // We defer all deletions to allow the full object to sync as a tombstone
        await tx.update(schema.noteMetadata)
            .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
            .where(eq(schema.noteMetadata.id, noteId))
            .run();
    });
}

export async function getQuickAccessNotes(): Promise<NoteMetadata[]> {
    const result = await getDb()
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
    return safeGetAll<NoteMetadata>(result);
}

export async function getPinnedNotesInFolder(folderId: string): Promise<NoteMetadata[]> {
    const result = await getDb()
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
    return safeGetAll<NoteMetadata>(result);
}

export async function getDeletedNotes(): Promise<NoteMetadata[]> {
    const result = await getDb()
        .select()
        .from(schema.noteMetadata)
        .where(
            and(
                eq(schema.noteMetadata.isDeleted, true),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
    return safeGetAll<NoteMetadata>(result);
}

// ============ CONTENT OPERATIONS (lazy loaded) ============

export async function getForwardLinks(noteId: string): Promise<(NoteMetadata & { blockId: string | null })[]> {
    const result = await getDb()
        .select({
            ...getTableColumns(schema.noteMetadata),
            blockId: schema.noteLinks.blockId,
        })
        .from(schema.noteLinks)
        .innerJoin(schema.noteMetadata, eq(schema.noteLinks.targetId, schema.noteMetadata.id))
        .where(
            and(
                eq(schema.noteLinks.sourceId, noteId),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
    return safeGetAll<NoteMetadata & { blockId: string | null }>(result as any);
}

export async function getBacklinks(noteId: string): Promise<(NoteMetadata & { blockId: string | null })[]> {
    const result = await getDb()
        .select({
            ...getTableColumns(schema.noteMetadata),
            blockId: schema.noteLinks.blockId,
        })
        .from(schema.noteLinks)
        .innerJoin(schema.noteMetadata, eq(schema.noteLinks.sourceId, schema.noteMetadata.id))
        .where(
            and(
                eq(schema.noteLinks.targetId, noteId),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false)
            )
        )
        .all();
    return safeGetAll<NoteMetadata & { blockId: string | null }>(result as any);
}

export async function getNoteContent(noteId: string): Promise<string> {
    const result = await getDb()
        .select()
        .from(schema.noteContent)
        .where(eq(schema.noteContent.id, noteId))
        .get();

    const safeResult = safeGet<{ content: string }>(result);

    const rawContent = safeResult?.content ?? '';
    const normalized = normalizeStoredContent(rawContent);

    noteLinksCache.set(noteId, extractLinks(normalized).map(l => l.fullUrl));
    noteFilesCache.set(noteId, extractFileIdsFromContent(normalized));

    // Self-heal previously stored rows that lost src attribute.
    if (result && normalized !== rawContent) {
        await getDb().update(schema.noteContent)
            .set({ content: normalized })
            .where(eq(schema.noteContent.id, noteId))
            .run();
    }

    return normalized;
}

export async function updateNoteContent(
    noteId: string,
    content: string,
    preview: string,
    title?: string,
    skipTasksUpdate = false,
    updatedAt?: Date,
    parsedTasks?: PendingTask[]
): Promise<void> {
    const now = updatedAt ?? new Date();
    const VERSION_THRESHOLD_MS = 120000; // 2 minutes
    const MAX_VERSIONS = 50;
    const normalizedContent = normalizeStoredContent(content);
    const byteSize = new TextEncoder().encode(normalizedContent).length;
    if (byteSize > MAX_NOTE_SIZE) {
        console.warn(`[Repo] Skipping note content update for ${noteId} due to size: ${byteSize} bytes`);
        return;
    }

    // Extract file IDs from canonical content
    const fileIds = extractFileIdsFromContent(normalizedContent);


    // 1. Update current content (Always)
    await getDb().transaction(async (tx: DbOrTx) => {
        await tx.update(schema.noteContent)
            .set({ content: normalizedContent })
            .where(eq(schema.noteContent.id, noteId))
            .run();

        // 2. Update preview and title in metadata
        const metadataUpdates: any = { preview, isDirty: true, updatedAt: now };
        if (title !== undefined) {
            metadataUpdates.title = title;
        }
        await tx.update(schema.noteMetadata)
            .set(metadataUpdates)
            .where(eq(schema.noteMetadata.id, noteId))
            .run();

        // 3. Handle Versioning
        // Get latest version (Try cache first, otherwise select only id and createdAt, avoiding heavy content fetch)
        let safeLatestVersion = latestVersionCache.get(noteId);

        if (!safeLatestVersion) {
            const latestVersion = await tx.select({
                id: schema.noteVersions.id,
                createdAt: schema.noteVersions.createdAt,
            })
                .from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, noteId))
                .orderBy(desc(schema.noteVersions.createdAt))
                .limit(1)
                .get();

            const dbLatest = safeGet<{ id: string; createdAt: Date }>(latestVersion);
            if (dbLatest) {
                safeLatestVersion = {
                    id: dbLatest.id,
                    createdAt: dbLatest.createdAt instanceof Date ? dbLatest.createdAt : new Date(dbLatest.createdAt),
                };
                latestVersionCache.set(noteId, safeLatestVersion);
            }
        }

        let activeVersionId: string;
        let didDeleteVersions = false;
        const isNewVersion = !safeLatestVersion || !safeLatestVersion.id || (now.getTime() - safeLatestVersion.createdAt.getTime() > VERSION_THRESHOLD_MS);

        if (isNewVersion) {
            // Case A: Create NEW version
            const newVersionId = generateId();
            await tx.insert(schema.noteVersions).values({
                id: newVersionId,
                noteId,
                content: normalizedContent,
                createdAt: now,
            }).run();
            activeVersionId = newVersionId;

            // Cache the newly created version
            latestVersionCache.set(noteId, { id: newVersionId, createdAt: now });

            // Enforce Limit (cleanup old versions)
            const versions = await tx.select({ id: schema.noteVersions.id }).from(schema.noteVersions)
                .where(eq(schema.noteVersions.noteId, noteId))
                .orderBy(desc(schema.noteVersions.createdAt))
                .all();

            const safeVersions = safeGetAll<{ id: string }>(versions);

            if (safeVersions.length > MAX_VERSIONS) {
                const versionsToDelete = safeVersions.slice(MAX_VERSIONS).map(v => v.id);
                if (versionsToDelete.length > 0) {
                    // Detach images from deleted versions
                    await FilesRepo.deleteFilesForVersions(versionsToDelete, tx);

                    await tx.delete(schema.noteVersions)
                        .where(inArray(schema.noteVersions.id, versionsToDelete))
                        .run();
                    didDeleteVersions = true;
                }
            }
        } else {
            // Case B: Update EXISTING latest version (debounce)
            // NOTE: We do NOT update the createdAt timestamp here to anchor the version checkpoint.
            await tx.update(schema.noteVersions)
                .set({ content: normalizedContent })
                .where(eq(schema.noteVersions.id, safeLatestVersion!.id))
                .run();
            activeVersionId = safeLatestVersion!.id;

            // Keep the cache updated but preserve the original creation time
            latestVersionCache.set(noteId, { id: activeVersionId, createdAt: safeLatestVersion!.createdAt });
        }

        // 4. Sync files to active version
        const oldFiles = noteFilesCache.get(noteId);
        const filesChanged = !oldFiles || !arraysEqual(oldFiles, fileIds);

        if (isNewVersion) {
            if (fileIds.length > 0) {
                await FilesRepo.setFilesForVersion(activeVersionId, fileIds, tx);
            }
            noteFilesCache.set(noteId, fileIds);
        } else if (filesChanged) {
            await FilesRepo.setFilesForVersion(activeVersionId, fileIds, tx);
            noteFilesCache.set(noteId, fileIds);
        }


        // 5. Garbage Collection: Only delete images if we actually deleted some version records
        if (didDeleteVersions) {
            const deletedFilePaths = await FilesRepo.deleteUnreferencedFiles(tx);
            // Clean up files (best effort)
            for (const path of deletedFilePaths) {
                await deleteFile(path);
            }
        }

        // Update links
        const newLinks = extractLinks(normalizedContent);
        const newLinksUrls = newLinks.map(l => l.fullUrl);
        const oldLinks = noteLinksCache.get(noteId);
        const linksChanged = !oldLinks || !arraysEqual(oldLinks, newLinksUrls);

        if (linksChanged) {
            await updateNoteLinks(noteId, newLinks, tx);
            noteLinksCache.set(noteId, newLinksUrls);
        }

        if (!skipTasksUpdate) {
            await updateNoteTasks(noteId, normalizedContent, tx, parsedTasks);
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

        const safeNotes = safeGetAll<{ id: string, content: string }>(notes);

        for (const note of safeNotes) {
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

        const safeVersionsList = safeGetAll<{ id: string, content: string }>(versions);

        for (const version of safeVersionsList) {
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
    const result = await getDb()
        .select({
            id: schema.noteVersions.id,
            createdAt: schema.noteVersions.createdAt
        })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.noteId, noteId))
        .orderBy(desc(schema.noteVersions.createdAt))
        .all();
    return safeGetAll<{ id: string; createdAt: Date }>(result);
}

export async function getNoteVersion(versionId: string) {
    const result = await getDb()
        .select()
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .get();

    const version = safeGet<any>(result);

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
    latestVersionCache.clear();
    await getDb().delete(schema.noteVersions)
        .where(eq(schema.noteVersions.id, versionId))
        .run();
}

export async function deleteAllNoteVersionsExceptLatest(noteId: string): Promise<void> {
    latestVersionCache.delete(noteId);
    const versions = await getDb()
        .select({ id: schema.noteVersions.id })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.noteId, noteId))
        .orderBy(desc(schema.noteVersions.createdAt))
        .all();

    const safeVersions = safeGetAll<{ id: string }>(versions);

    if (safeVersions.length <= 1) return;

    const versionsToDelete = safeVersions.slice(1).map(v => v.id);

    await getDb().transaction(async (tx: DbOrTx) => {
        await FilesRepo.deleteFilesForVersions(versionsToDelete, tx);
        await tx.delete(schema.noteVersions)
            .where(inArray(schema.noteVersions.id, versionsToDelete))
            .run();

        const deletedFilePaths = await FilesRepo.deleteUnreferencedFiles(tx);
        for (const path of deletedFilePaths) {
            await deleteFile(path);
        }
    });
}

export async function getRecentNotes(limitCount: number = 5): Promise<NoteMetadata[]> {
    const result = await getDb()
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
    return safeGetAll<NoteMetadata>(result);
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
            isDirty: true,
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
            isDirty: true,
            updatedAt: new Date(),
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

    const safeResults = safeGetAll<{ id: string }>(results);

    return safeResults.map(r => r.id);
}

export async function getDeletedNoteIds(tx: DbOrTx = getDb()): Promise<string[]> {
    const results = await tx.select({ id: schema.noteMetadata.id })
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isDeleted, true))
        .all();
    const safeResults = safeGetAll<{ id: string }>(results);
    return safeResults.map(r => r.id);
}

export async function getNotesCount(tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx.select({ count: sql<number>`count(*)` })
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isPermDeleted, false))
        .get();
    const safeResult = safeGet<{ count: number }>(result);
    return safeResult?.count ?? 0;
}

/**
 * Remove a tag ID from every note's JSON `tags` array.
 * Marks affected notes as dirty so changes will sync.
 */
export async function removeTagFromAllNotes(tagId: string, tx: DbOrTx = getDb()): Promise<void> {
    // Find all notes whose tags JSON contains this tag ID
    const allNotes = await tx.select({ id: schema.noteMetadata.id, tags: schema.noteMetadata.tags })
        .from(schema.noteMetadata)
        .all();

    const safeNotes = safeGetAll<{ id: string; tags: string }>(allNotes);
    const now = new Date();

    for (const note of safeNotes) {
        let tagsArray: string[];
        try {
            tagsArray = JSON.parse(note.tags);
        } catch {
            continue;
        }

        if (!tagsArray.includes(tagId)) continue;

        const updatedTags = tagsArray.filter(id => id !== tagId);
        await tx.update(schema.noteMetadata)
            .set({ tags: JSON.stringify(updatedTags), isDirty: true, updatedAt: now })
            .where(eq(schema.noteMetadata.id, note.id))
            .run();
    }
}

export async function healRootFolderIds(): Promise<void> {
    const db = getDb();
    
    // Self-heal notes where folderId is 'root' or empty string
    await db.update(schema.noteMetadata)
        .set({ folderId: null, isDirty: true })
        .where(or(
            eq(schema.noteMetadata.folderId, 'root'),
            eq(schema.noteMetadata.folderId, '')
        ))
        .run();
        
    // Also self-heal originalFolderId
    await db.update(schema.noteMetadata)
        .set({ originalFolderId: null, isDirty: true })
        .where(or(
            eq(schema.noteMetadata.originalFolderId, 'root'),
            eq(schema.noteMetadata.originalFolderId, '')
        ))
        .run();
}

export async function getAllNotesMetadata(tx: DbOrTx = getDb()): Promise<NoteMetadata[]> {
    const result = await tx.select()
        .from(schema.noteMetadata)
        .where(eq(schema.noteMetadata.isPermDeleted, false))
        .all();
    return safeGetAll<NoteMetadata>(result);
}
