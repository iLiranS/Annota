import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../../adapters';
import * as FilesRepo from '../../db/repositories/files.repository';
import * as NotesRepo from '../../db/repositories/notes.repository';
import {
    computeHash,
    deleteFile,
    downloadRemoteFile,
    getFileSize,
    readAsBase64DataUri,
    resizeAndCompress,
    saveToLocalStorage
} from './file.service';

// ============ CONSTANTS ============
const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB limit for PDFs

// ============ TYPES ============

export interface ProcessedFile {
    fileId: string;
    isNew: boolean; // false if deduplicated
    fileName: string;
    fileSize: number;
    mimeType: string;
    localPath: string;
}

function getExtensionFromMime(base64: string): string {
    const mimeMatch = base64.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,/i);
    if (mimeMatch) {
        const mime = mimeMatch[1].toLowerCase();
        if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
        if (mime === 'image/png') return 'png';
        if (mime === 'image/webp') return 'webp';
        if (mime === 'image/gif') return 'gif';
        if (mime === 'application/pdf') return 'pdf';
    }
    return 'png';
}

function getFileTypeFromMime(mime: string): 'image' | 'pdf' {
    return mime === 'application/pdf' ? 'pdf' : 'image';
}

/**
 * Unified helper to save a file from a base64 string directly into a note.
 * Handles temporary storage, processing (resize/hash), and DB insertion.
 */
export async function saveNoteFile(noteId: string, base64: string): Promise<ProcessedFile & { id: string, url: string }> {
    try {
        const extension = getExtensionFromMime(base64);
        const mimeMatch = base64.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,/i);
        const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : (extension === 'pdf' ? 'application/pdf' : 'image/png');
        
        const base64Data = base64.replace(/^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/, "");
        const rawBytes = Buffer.from(base64Data, 'base64');
        const adapters = getPlatformAdapters();
        const cacheDir = await adapters.fileSystem.ensureDir('cache');
        const tempPath = `${cacheDir}/pasted-${Date.now()}.${extension}`;
        await adapters.fileSystem.writeBytes(tempPath, new Uint8Array(rawBytes));

        const processed = await processAndInsertFile(noteId, tempPath, mimeType);
        const fileMap = await resolveFileSources([processed.fileId]);
        return {
            ...processed,
            id: processed.fileId,
            url: fileMap[processed.fileId]
        };
    } catch (err) {
        console.error("[NoteFileService] Failed to save note file:", err);
        throw err;
    }
}

// ============ FILE PROCESSING PIPELINE ============

/**
 * Full pipeline: resize (images) → hash → dedupe → save → insert DB → attach to note.
 * Works for both device-picked files and downloaded remote files.
 */
export async function processAndInsertFile(
    _noteId: string,
    sourceUri: string,
    mimeType?: string,
): Promise<ProcessedFile> {
    const adapters = getPlatformAdapters();

    // 0. FAST PATH: Check if this is an internal app URI we've already processed
    if (!sourceUri.startsWith('data:')) {
        const filename = sourceUri.split(/[\/\\]/).pop();
        if (filename) {
            const existingByPath = await FilesRepo.getFileByLocalPath(filename);
            if (existingByPath) {
                console.log('File already exists (matched by localPath):', existingByPath.id);
                return {
                    fileId: existingByPath.id,
                    isNew: false,
                    fileName: existingByPath.localPath,
                    fileSize: existingByPath.sizeBytes || 0,
                    mimeType: existingByPath.mimeType || 'application/octet-stream',
                    localPath: existingByPath.localPath,
                };
            }
        }
    }

    // 1. Initial metadata
    const size = await getFileSize(sourceUri);
    // If mimeType wasn't passed, try to guess from extension
    if (!mimeType) {
        const ext = sourceUri.split('.').pop()?.toLowerCase();
        mimeType = ext === 'pdf' ? 'application/pdf' : 'image/webp';
    }
    const fileType = getFileTypeFromMime(mimeType);

    // 2. Validation
    if (fileType === 'pdf' && size > MAX_PDF_SIZE) {
        throw new Error(`PDF size exceeds ${MAX_PDF_SIZE / (1024 * 1024)}MB limit`);
    }

    // 3. Compute hash of the INCOMING file
    const incomingHash = await computeHash(sourceUri);

    // 4. Check for duplicate against BOTH hashes
    const existing = await FilesRepo.getFileByAnyHash(incomingHash);
    if (existing) {
        console.log('File already exists (matched by hash):', existing.id);
        return {
            fileId: existing.id,
            isNew: false,
            fileName: existing.localPath,
            fileSize: existing.sizeBytes || 0,
            mimeType: existing.mimeType || 'application/octet-stream',
            localPath: existing.localPath,
        };
    }

    // 5. Processing
    // Images: Resize and compress to WebP
    // PDFs: Bypass compression
    const processed = await resizeAndCompress(sourceUri, fileType);

    // 6. Compute the compressed hash
    // For PDFs: sourceHash and compressedHash are identical
    let compressedHash = incomingHash;
    if (fileType === 'image') {
        compressedHash = await computeHash(processed.uri);
    }

    // 7. Generate new ID and save file to persistent storage
    const fileId = Buffer.from(adapters.crypto.randomBytes(16)).toString('hex');
    const fullPath = await saveToLocalStorage(processed.uri, fileId, fileType);
    const filename = fullPath.split('/').pop() || fullPath;

    // 8. Re-fetch final size (WebP size might differ from original)
    const finalSize = await getFileSize(fullPath);

    // 9. Insert into DB tracking BOTH hashes
    await FilesRepo.insertFile({
        id: fileId,
        sourceHash: incomingHash,
        compressedHash: compressedHash,
        localPath: filename,
        mimeType: fileType === 'pdf' ? 'application/pdf' : 'image/webp',
        fileType: fileType,
        sizeBytes: finalSize ?? size ?? 0,
        width: processed.width,
        height: processed.height,
        syncStatus: 'pending',
        createdAt: new Date(),
    });

    return {
        fileId,
        isNew: true,
        fileName: filename,
        fileSize: finalSize ?? size ?? 0,
        mimeType: fileType === 'pdf' ? 'application/pdf' : 'image/webp',
        localPath: filename,
    };
}

/**
 * Download a remote URL and process it through the local pipeline.
 */
export async function processRemoteFile(
    noteId: string,
    url: string,
): Promise<ProcessedFile> {
    const temp = await downloadRemoteFile(url);
    try {
        return await processAndInsertFile(noteId, temp.uri);
    } finally {
        await temp.cleanup();
    }
}

// ============ FILE RESOLUTION ============

/**
 * Resolve file IDs to base64 data URIs for WebView injection.
 * Returns a map of fileId → dataUri.
 */
export async function resolveFileSources(
    fileIds: string[],
): Promise<Record<string, string>> {
    if (fileIds.length === 0) return {};

    const fileRecords = await FilesRepo.getFilesByIds(fileIds);
    const result: Record<string, string> = {};

    await Promise.all(
        fileRecords.map(async (file) => {
            try {
                result[file.id] = await readAsBase64DataUri(file.localPath);
            } catch (err) {
                console.warn(`Failed to resolve file ${file.id}:`, err);
            }
        }),
    );

    return result;
}

// ============ CLEANUP ============

/**
 * Handle file cleanup when a note is permanently deleted.
 */
export async function cleanupFilesForNote(noteId: string): Promise<void> {
    const versions = await NotesRepo.getNoteVersions(noteId);
    if (versions.length === 0) return;

    const versionIds = versions.map(v => v.id);

    // Get file IDs used by these versions
    const fileIds = await FilesRepo.getFileIdsForVersions(versionIds);
    if (fileIds.length === 0) return;

    // Delete links
    await FilesRepo.deleteFilesForVersions(versionIds);

    // Identify and delete orphans (force check, ignore time buffer)
    const distinctIds = Array.from(new Set(fileIds));
    const deletedPaths = await FilesRepo.deleteFilesIfUnreferenced(distinctIds);

    // Delete files
    for (const path of deletedPaths) {
        await deleteFile(path);
    }
}

export async function getFileIdsForVersion(versionId: string): Promise<string[]> {
    return await FilesRepo.getFileIdsForVersions([versionId]);
}

export async function cleanupOrphans(fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;

    const distinctIds = Array.from(new Set(fileIds));
    // Check if these files are still referenced by ANY version
    const deletedPaths = await FilesRepo.deleteFilesIfUnreferenced(distinctIds);

    // Delete files
    for (const path of deletedPaths) {
        await deleteFile(path);
    }
}
