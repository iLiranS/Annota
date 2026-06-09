import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import type { DownloadQueueInsert, DownloadQueueRecord, FileInsert, FileRecord } from '../schema';
import { fileDownloadQueue, files, noteVersions, versionFiles } from '../schema';
import type { DbOrTx } from '../types';
import { safeGet, safeGetAll } from '../utils';

export type { FileRecord } from '../schema';
import { noteMetadata } from '../schema';

// ============ TYPES ============

export interface MediaNoteAssociation {
    noteId: string;
    noteTitle: string;
    folderId: string | null;
    isLatest: boolean;
}

export interface MediaItem extends FileRecord {
    notes: MediaNoteAssociation[];
}

// ============ FILE OPERATIONS ============

export async function getFileById(fileId: string, tx: DbOrTx = getDb()): Promise<FileRecord | null> {
    const result = await tx.select().from(files).where(eq(files.id, fileId)).get();
    const safeResult = safeGet<FileRecord>(result);
    // Guard against Drizzle ghost object { createdAt: null } on empty results (Tauri IPC quirk)
    if (!safeResult || !safeResult.id) return null;
    return safeResult;
}

export async function getFileByLocalPath(localPath: string, tx: DbOrTx = getDb()): Promise<FileRecord | null> {
    const result = await tx.select().from(files).where(eq(files.localPath, localPath)).get();
    const safeResult = safeGet<FileRecord>(result);
    if (!safeResult || !safeResult.id) return null;
    return safeResult;
}

export async function getFileByAnyHash(hash: string, tx: DbOrTx = getDb()): Promise<FileRecord | null> {
    const result = await tx.select().from(files)
        .where(
            or(
                eq(files.sourceHash, hash),
                eq(files.compressedHash, hash)
            )
        )
        .get();
    const safeResult = safeGet<FileRecord>(result);
    if (!safeResult || !safeResult.id) return null;
    return safeResult;
}

export async function getFilesByIds(ids: string[], tx: DbOrTx = getDb()): Promise<FileRecord[]> {
    if (ids.length === 0) return [];
    const result = await tx.select().from(files).where(inArray(files.id, ids)).all();
    return safeGetAll<FileRecord>(result);
}

export async function insertFile(data: FileInsert, tx: DbOrTx = getDb()): Promise<FileRecord> {
    return await tx.insert(files).values(data).returning().get();
}

export async function deleteFileRecord(fileId: string, tx: DbOrTx = getDb()): Promise<void> {
    await tx.delete(files).where(eq(files.id, fileId)).run();
}


export async function getAllFilePaths(tx: DbOrTx = getDb()): Promise<string[]> {
    const result = await tx.select({ localPath: files.localPath }).from(files).all();
    return safeGetAll<{ localPath: string }>(result).map(r => r.localPath);
}

// ============ VERSION-FILE OPERATIONS ============

/**
 * atomic update of files for a version
 */
export async function setFilesForVersion(versionId: string, fileIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    // 1. Delete existing associations for this version
    await tx.delete(versionFiles).where(eq(versionFiles.versionId, versionId)).run();

    // 2. Insert new associations
    const uniqueFileIds = Array.from(new Set(fileIds));
    if (uniqueFileIds.length > 0) {
        await tx.insert(versionFiles)
            .values(uniqueFileIds.map(fileId => ({ versionId, fileId })))
            .onConflictDoNothing()
            .run();
    }
}

export async function deleteFilesForVersions(versionIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (versionIds.length === 0) return;
    await tx.delete(versionFiles).where(inArray(versionFiles.versionId, versionIds)).run();
}

export async function countFileReferences(fileId: string, tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx
        .select({ count: sql<number>`count(*)` })
        .from(versionFiles)
        .where(eq(versionFiles.fileId, fileId))
        .get();
    const safeResult = safeGet<{ count: number }>(result);
    return safeResult?.count ?? 0;
}

// ============ GC OPERATIONS ============
export async function getFileIdsForVersions(versionIds: string[], tx: DbOrTx = getDb()): Promise<string[]> {
    if (versionIds.length === 0) return [];
    const result = await tx.select({ fileId: versionFiles.fileId })
        .from(versionFiles)
        .where(inArray(versionFiles.versionId, versionIds))
        .all();
    return safeGetAll<{ fileId: string }>(result).map(r => r.fileId);
}

/**
 * Garbage Collection: Delete files that are not referenced by ANY version
 * and are older than 5 minutes (to avoid race conditions with new uploads).
 */
export async function deleteUnreferencedFiles(tx: DbOrTx = getDb(), ignoreTimeBuffer = false): Promise<string[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Find orphan files
    let condition;
    if (ignoreTimeBuffer) {
        // Strict check: Not in version_files at all
        condition = sql`${files.id} NOT IN (SELECT ${versionFiles.fileId} FROM ${versionFiles})`;
    } else {
        // Safe check: Not in version_files AND old enough
        condition = and(
            sql`${files.id} NOT IN (SELECT ${versionFiles.fileId} FROM ${versionFiles})`,
            sql`${files.createdAt} < ${fiveMinutesAgo.toISOString()}`
        );
    }

    const orphans = await tx.select({ id: files.id, localPath: files.localPath })
        .from(files)
        .where(condition)
        .all();
    const safeOrphans = safeGetAll<{ id: string, localPath: string }>(orphans);
    if (safeOrphans.length === 0) return [];

    const orphanIds = safeOrphans.map(o => o.id);

    // Delete DB records
    await tx.delete(files).where(inArray(files.id, orphanIds)).run();

    // Return paths so caller can delete files
    return safeOrphans.map(o => o.localPath);
}

/**
 * delete specific files permissions if they are no longer referenced by any version.
 * Used when permanently deleting notes/versions to clean up immediately (ignoring time buffer).
 */
export async function deleteFilesIfUnreferenced(fileIds: string[], tx: DbOrTx = getDb()): Promise<string[]> {
    if (fileIds.length === 0) return [];

    // Filter to find which of these are TRULY unreferenced now
    const trulyOrphaned: string[] = [];
    for (const id of fileIds) {
        const countRes = await tx
            .select({ count: sql<number>`count(*)` })
            .from(versionFiles)
            .where(eq(versionFiles.fileId, id))
            .get();
        const safeCountRes = safeGet<{ count: number }>(countRes);
        if ((safeCountRes?.count ?? 0) === 0) {
            trulyOrphaned.push(id);
        }
    }

    if (trulyOrphaned.length === 0) return [];

    // Get paths before deleting
    const recordsToDelete = await tx.select({ localPath: files.localPath })
        .from(files)
        .where(inArray(files.id, trulyOrphaned))
        .all();

    const safeRecordsToDelete = safeGetAll<{ localPath: string }>(recordsToDelete);

    // Delete DB records
    await tx.delete(files).where(inArray(files.id, trulyOrphaned)).run();

    return safeRecordsToDelete.map(f => f.localPath);
}

export async function getStorageStats(tx: DbOrTx = getDb()) {
    const fileCountRow = await tx.select({ count: sql<number>`count(*)` }).from(files).get();
    const totalFiles = safeGet<{ count: number }>(fileCountRow)?.count ?? 0;

    const linkCountRow = await tx.select({ count: sql<number>`count(*)` }).from(versionFiles).get();
    const totalLinks = safeGet<{ count: number }>(linkCountRow)?.count ?? 0;

    const fileSizeRow = await tx.select({ sum: sql<number>`sum(${files.sizeBytes})` }).from(files).get();
    const totalFilesSize = safeGet<{ sum: number }>(fileSizeRow)?.sum ?? 0;

    // Orphans (ignoring time buffer)
    const orphanRow = await tx.select({ count: sql<number>`count(*)` })
        .from(files)
        .where(sql`${files.id} NOT IN (SELECT ${versionFiles.fileId} FROM ${versionFiles})`)
        .get();
    const orphans = safeGet<{ count: number }>(orphanRow)?.count ?? 0;

    return { totalFiles, totalLinks, orphans, totalFilesSize };
}

export async function deleteOrphanLinks(tx: DbOrTx = getDb()): Promise<void> {
    // Delete links pointing to non-existent versions
    await tx.delete(versionFiles)
        .where(
            sql`${versionFiles.versionId} NOT IN (SELECT ${noteVersions.id} FROM ${noteVersions})`
        )
        .run();
}

// ============ SYNC OPERATIONS ============

export async function getLastSyncedFileIds(noteId: string, tx: DbOrTx = getDb()): Promise<string[]> {
    const result = await tx.select({ lastSyncedFileIds: noteMetadata.lastSyncedFileIds })
        .from(noteMetadata)
        .where(eq(noteMetadata.id, noteId))
        .get();
    const safeResult = safeGet<{ lastSyncedFileIds: string }>(result);
    if (!safeResult) return [];
    try {
        return JSON.parse(safeResult.lastSyncedFileIds || '[]');
    } catch {
        return [];
    }
}

export async function updateLastSyncedFileIds(noteId: string, fileIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    await tx.update(noteMetadata)
        .set({ lastSyncedFileIds: JSON.stringify(fileIds) })
        .where(eq(noteMetadata.id, noteId))
        .run();
}

/**
 * Returns a list of file records that are pending sync AND are linked to the 
 * latest version of any note. We skip files that are only in older history.
 */
export async function getPendingFilesLinkedToLatestVersions(tx: DbOrTx = getDb()): Promise<{
    file: FileRecord;
    noteId: string;
}[]> {
    // 1. Get the latest version ID for each note
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

    // 2. Find files linked to those versions that are pending
    const results = await tx
        .select({
            file: files,
            versionId: versionFiles.versionId,
        })
        .from(files)
        .innerJoin(versionFiles, eq(files.id, versionFiles.fileId))
        .where(
            and(
                eq(files.syncStatus, 'pending'),
                inArray(versionFiles.versionId, latestVersionIds)
            )
        )
        .all();

    const safeResults = safeGetAll<{ file: FileRecord; versionId: string }>(results);

    // 3. Map back to include the noteId for easier insertion into note_files later
    const versionNoteMap = new Map(
        safeLatestVersions.map(v => [v.id, v.noteId] as const),
    );

    // We might have duplicates if a file is in multiple head versions of DIFFERENT notes.
    return safeResults.map(row => ({
        file: row.file,
        noteId: versionNoteMap.get(row.versionId) as string,
    }));
}

/**
 * Returns the latest-version file IDs for each provided note ID.
 * Notes without a latest version (or without linked files) are returned with an empty fileIds array.
 */
export async function getLatestVersionFileIdsForNotes(noteIds: string[], tx: DbOrTx = getDb()): Promise<{
    noteId: string;
    fileIds: string[];
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

    const fileIdsByNote = new Map<string, Set<string>>();
    for (const noteId of uniqueNoteIds) {
        fileIdsByNote.set(noteId, new Set<string>());
    }

    if (safeLatestVersions.length === 0) {
        return uniqueNoteIds.map(noteId => ({ noteId, fileIds: [] }));
    }

    const latestVersionIds = safeLatestVersions.map(v => v.id);
    const versionToNote = new Map(
        safeLatestVersions.map(v => [v.id, v.noteId] as const),
    );

    const links = await tx
        .select({
            versionId: versionFiles.versionId,
            fileId: versionFiles.fileId,
        })
        .from(versionFiles)
        .where(inArray(versionFiles.versionId, latestVersionIds))
        .all();

    const safeLinks = safeGetAll<{ versionId: string, fileId: string }>(links);

    for (const link of safeLinks) {
        const noteId = versionToNote.get(link.versionId) as string | undefined;
        if (!noteId) continue;
        fileIdsByNote.get(noteId)?.add(link.fileId as string);
    }

    return uniqueNoteIds.map(noteId => ({
        noteId,
        fileIds: Array.from(fileIdsByNote.get(noteId) ?? []),
    }));
}

export async function markFilesAsSynced(fileIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (fileIds.length === 0) return;
    await tx.update(files)
        .set({ syncStatus: 'synced' })
        .where(inArray(files.id, fileIds))
        .run();
}
// Revert files to pending (used when sync fails)
export async function revertFilesToPending(fileIds: string[], tx: DbOrTx = getDb()): Promise<void> {
    if (fileIds.length === 0) return;
    await tx.update(files)
        .set({ syncStatus: 'pending' })
        .where(inArray(files.id, fileIds))
        .run();
}

// ============ DOWNLOAD QUEUE OPERATIONS ============

export async function upsertDownloadQueue(items: DownloadQueueInsert[], tx: DbOrTx = getDb()): Promise<void> {
    if (items.length === 0) return;

    // Insert batch. If the fileId is already in the queue, ignore it.
    await tx.insert(fileDownloadQueue)
        .values(items)
        .onConflictDoNothing()
        .run();
}

export async function removeFromDownloadQueue(fileId: string, tx: DbOrTx = getDb()): Promise<void> {
    await tx.delete(fileDownloadQueue)
        .where(eq(fileDownloadQueue.fileId, fileId))
        .run();
}

export async function getPendingDownloads(tx: DbOrTx = getDb()): Promise<DownloadQueueRecord[]> {
    // Fetch all pending downloads to retry them
    const result = await tx.select().from(fileDownloadQueue).all();
    return safeGetAll<DownloadQueueRecord>(result);
}

/**
 * High-performance paginated media fetcher for the secondary sidebar.
 * Handles search (across note titles/content), adaptive grid pagination,
 * and identifies which notes/versions each file belongs to.
 */
export async function getPaginatedMedia(
    page: number,
    pageSize: number = 20,
    searchQuery?: string,
    tx: DbOrTx = getDb()
): Promise<{ items: MediaItem[], totalCount: number, hasMore: boolean }> {
    const offset = (page - 1) * pageSize;

    // 1. Build the base query for files
    let fileQuery = tx.select({ file: files })
        .from(files)
        .where(
            or(
                eq(files.fileType, 'image'),
                eq(files.fileType, 'pdf')
            )
        );

    // 2. Apply search filter if provided (using FTS5 for performance)
    if (searchQuery && searchQuery.trim()) {
        const pattern = `${searchQuery.trim().replace(/"/g, '""')}*`;
        fileQuery = tx.select({ file: files })
            .from(files)
            .where(
                and(
                    or(
                        eq(files.fileType, 'image'),
                        eq(files.fileType, 'pdf')
                    ),
                    sql`${files.id} IN (
                        SELECT vf.file_id 
                        FROM ${versionFiles} vf
                        JOIN ${noteVersions} nv ON vf.version_id = nv.id
                        WHERE nv.note_id IN (
                            SELECT id FROM notes_fts WHERE notes_fts MATCH ${pattern}
                        )
                    )`
                )
            );
    }

    // 3. Get total count
    const countResult = await tx.select({ count: sql<number>`count(*)` })
        .from(fileQuery.as('filtered_files'))
        .get();
    const totalCount = safeGet<{ count: number }>(countResult)?.count ?? 0;

    if (totalCount === 0) return { items: [], totalCount: 0, hasMore: false };

    // 4. Fetch paginated files
    const paginatedFiles = await fileQuery
        .orderBy(sql`${files.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset)
        .all();

    const safeFiles = safeGetAll<{ file: FileRecord }>(paginatedFiles).map(r => r.file);
    if (safeFiles.length === 0) return { items: [], totalCount, hasMore: false };

    const fileIds = safeFiles.map(f => f.id);

    // Optimize: Identify the latest version ID for each note using a window function
    const latestVersionsSubquery = tx.select({
        noteId: noteVersions.noteId,
        id: noteVersions.id,
        rank: sql<number>`row_number() OVER (PARTITION BY ${noteVersions.noteId} ORDER BY ${noteVersions.createdAt} DESC)`.as('rank')
    })
    .from(noteVersions)
    .as('lv');

    const associations = await tx.select({
        fileId: versionFiles.fileId,
        noteId: noteMetadata.id,
        noteTitle: noteMetadata.title,
        folderId: noteMetadata.folderId,
        versionId: noteVersions.id,
        isLatest: sql<boolean>`lv.rank = 1`
    })
    .from(versionFiles)
    .innerJoin(noteVersions, eq(versionFiles.versionId, noteVersions.id))
    .innerJoin(noteMetadata, eq(noteVersions.noteId, noteMetadata.id))
    .leftJoin(latestVersionsSubquery, and(
        eq(noteMetadata.id, latestVersionsSubquery.noteId),
        eq(noteVersions.id, latestVersionsSubquery.id)
    ))
    .where(inArray(versionFiles.fileId, fileIds))
    .all();

    const safeAssociations = safeGetAll<{
        fileId: string;
        noteId: string;
        noteTitle: string;
        folderId: string | null;
        versionId: string;
        isLatest: boolean;
    }>(associations);

    // 6. Group associations by fileId
    const associationsByFile = new Map<string, MediaNoteAssociation[]>();
    for (const assoc of safeAssociations) {
        if (!associationsByFile.has(assoc.fileId)) {
            associationsByFile.set(assoc.fileId, []);
        }
        
        const existing = associationsByFile.get(assoc.fileId)!.find(a => a.noteId === assoc.noteId);
        if (existing) {
            if (assoc.isLatest) existing.isLatest = true;
        } else {
            associationsByFile.get(assoc.fileId)!.push({
                noteId: assoc.noteId,
                noteTitle: assoc.noteTitle,
                folderId: assoc.folderId,
                isLatest: assoc.isLatest
            });
        }
    }

    // 7. Combine files with their associations
    const items: MediaItem[] = safeFiles.map(file => ({
        ...file,
        notes: associationsByFile.get(file.id) || []
    }));

    const hasMore = offset + items.length < totalCount;

    return { items, totalCount, hasMore };
}
