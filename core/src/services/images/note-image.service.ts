import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../../adapters';
import * as ImagesRepo from '../../db/repositories/images.repository';
import * as NotesRepo from '../../db/repositories/notes.repository';
import {
    computeHash,
    deleteImageFile,
    downloadRemoteImage,
    getFileSize,
    readAsBase64DataUri,
    resizeAndCompress,
    saveToLocalStorage
} from './image.service';

// ============ TYPES ============

export interface ProcessedImage {
    imageId: string;
    isNew: boolean; // false if deduplicated
}

// ============ IMAGE PROCESSING PIPELINE ============

/**
 * Full pipeline: resize → hash → dedupe → save → insert DB → attach to note.
 * Works for both device-picked images and downloaded remote images.
 */
export async function processAndInsertImage(
    _noteId: string,
    sourceUri: string,
): Promise<ProcessedImage> {
    // 1. Resize and compress
    const resized = await resizeAndCompress(sourceUri);

    // 2. Compute hash of resized image
    const hash = await computeHash(resized.uri);

    // 3. Check for duplicate
    const existing = await ImagesRepo.getImageByHash(hash);
    if (existing) {
        console.log('Image already exists:', existing.id);
        // Reuse existing image, return ID (Linkage happens in updateNoteContent)
        return { imageId: existing.id, isNew: false };
    }

    // 4. Generate new ID and save file
    const imageId = Buffer.from(getPlatformAdapters().crypto.randomBytes(16)).toString('hex');
    const localPath = await saveToLocalStorage(resized.uri, imageId);

    // 5. Get file size
    const size = await getFileSize(localPath);

    // 6. Insert into DB
    await ImagesRepo.insertImage({
        id: imageId,
        hash,
        localPath,
        mimeType: 'image/webp',
        size: size ?? null,
        width: resized.width,
        height: resized.height,
        syncStatus: 'pending',
        createdAt: new Date(),
    });

    // 7. Return info (Linkage happens in updateNoteContent)
    return { imageId, isNew: true };
}

/**
 * Download a remote URL image and process it through the local pipeline.
 */
export async function processRemoteImage(
    noteId: string,
    url: string,
): Promise<ProcessedImage> {
    const temp = await downloadRemoteImage(url);
    try {
        return await processAndInsertImage(noteId, temp.uri);
    } finally {
        await temp.cleanup();
    }
}

// ============ IMAGE RESOLUTION ============

/**
 * Resolve image IDs to base64 data URIs for WebView injection.
 * Returns a map of imageId → dataUri.
 */
export async function resolveImageSources(
    imageIds: string[],
): Promise<Record<string, string>> {
    if (imageIds.length === 0) return {};

    const images = await ImagesRepo.getImagesByIds(imageIds);
    const result: Record<string, string> = {};

    await Promise.all(
        images.map(async (img) => {
            try {
                result[img.id] = await readAsBase64DataUri(img.localPath);
            } catch (err) {
                console.warn(`Failed to read image ${img.id}:`, err);
                // Image file may have been deleted — skip it
            }
        }),
    );

    return result;
}

// ============ CLEANUP ============

/**
 * Handle image cleanup when a note is permanently deleted.
 * 1. Find all versions of the note.
 * 2. Find all images linked to these versions.
 * 3. Delete version-image links.
 * 4. Check for orphans (images not used by ANY version anymore).
 * 5. Delete orphan files and DB records.
 */
export async function cleanupImagesForNote(noteId: string): Promise<void> {
    const versions = await NotesRepo.getNoteVersions(noteId);
    if (versions.length === 0) return;

    const versionIds = versions.map(v => v.id);

    // Get image IDs used by these versions (BEFORE deleting links)
    const imageIds = await ImagesRepo.getImageIdsForVersions(versionIds);
    if (imageIds.length === 0) return;

    // Delete links
    await ImagesRepo.deleteImagesForVersions(versionIds);

    // Identify and delete orphans (force check, ignore time buffer)
    const distinctIds = Array.from(new Set(imageIds));
    const deletedPaths = await ImagesRepo.deleteImagesIfUnreferenced(distinctIds);

    // Delete files
    for (const path of deletedPaths) {
        await deleteImageFile(path);
    }
}

export async function getImageIdsForVersion(versionId: string): Promise<string[]> {
    return await ImagesRepo.getImageIdsForVersions([versionId]);
}

export async function cleanupOrphans(imageIds: string[]): Promise<void> {
    if (imageIds.length === 0) return;

    const distinctIds = Array.from(new Set(imageIds));
    // Check if these images are still referenced by ANY version
    const deletedPaths = await ImagesRepo.deleteImagesIfUnreferenced(distinctIds);

    // Delete files
    for (const path of deletedPaths) {
        await deleteImageFile(path);
    }
}
