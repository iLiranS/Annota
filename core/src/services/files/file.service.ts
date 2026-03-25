import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../../adapters';

// ============ CONSTANTS ============

const MAX_DIMENSION = 1500;
const WEBP_QUALITY = 0.8;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ============ DIRECTORY MANAGEMENT ============

export async function getFilesDirectory(): Promise<string> {
    return await getPlatformAdapters().fileSystem.ensureDir('files');
}

/**
 * Resolves a stored path (which could be a full path or just a filename)
 * to a current absolute URI. This is necessary because iOS app container UUIDs
 * change on rebuild/update.
 */
export async function resolveLocalUri(storedPath: string): Promise<string> {
    if (!storedPath) return '';

    // If it's already an absolute file URI or path, return it as is.
    // This is CRITICAL for temp files (downloads/camera) to not be re-rooted
    // to the files directory before they are actually saved there.
    if (storedPath.startsWith('/') || storedPath.startsWith('file://')) {
        return storedPath;
    }

    // Otherwise, assume it's a filename relative to the persistent files directory.
    let filename = storedPath;
    if (storedPath.includes('/') || storedPath.includes('\\')) {
        filename = storedPath.split(/[/\\]/).pop() || storedPath;
    }

    const dir = await getFilesDirectory();
    const separator = dir.endsWith('/') ? '' : '/';
    return `${dir}${separator}${filename}`;
}

// ============ FILE PROCESSING ============

/**
 * Resize and compress an image to WEBP.
 * Targets the long edge to MAX_DIMENSION (landscape → width, portrait → height).
 * Skips resize if both dimensions are already within limits.
 * Bypasses completely for PDFs.
 */
export async function resizeAndCompress(uri: string, fileType: string = 'image'): Promise<{ uri: string; width: number | null; height: number | null }> {
    if (fileType === 'pdf') {
        return { uri, width: null, height: null };
    }

    const { path, width, height } = await getPlatformAdapters().image.resizeAndCompress(uri, {
        maxDimension: MAX_DIMENSION,
        quality: WEBP_QUALITY,
        format: 'webp',
    });
    return { uri: path, width, height };
}

/**
 * Compute SHA-256 hash of a file's contents.
 * Reads as base64 then hashes — ensures consistent hashing after resize.
 */
export async function computeHash(fileUri: string): Promise<string> {
    const base64 = await getPlatformAdapters().fileSystem.readBase64(fileUri);
    return await getPlatformAdapters().crypto.sha256HexUtf8(base64);
}

/**
 * Save a file to the local files directory.
 * Returns the final local path (URI).
 */
export async function saveToLocalStorage(sourceUri: string, fileId: string, fileType: string = 'image'): Promise<string> {
    const dir = await getFilesDirectory();
    const separator = dir.endsWith('/') ? '' : '/';
    const extension = fileType === 'pdf' ? 'pdf' : 'webp';
    const destPath = `${dir}${separator}${fileId}.${extension}`;
    await getPlatformAdapters().fileSystem.copyFile(sourceUri, destPath);
    return destPath;
}

/**
 * Read a file as a base64 data URI for WebView injection.
 * Returns `data:image/webp;base64,...` or `data:application/pdf;base64,...`
 */
export async function readAsBase64DataUri(localPath: string): Promise<string> {
    const absoluteUri = await resolveLocalUri(localPath);
    const base64 = await getPlatformAdapters().fileSystem.readBase64(absoluteUri);
    
    let mime = 'image/webp';
    if (absoluteUri.endsWith('.pdf')) {
        mime = 'application/pdf';
    } else if (absoluteUri.endsWith('.jpg') || absoluteUri.endsWith('.jpeg')) {
        mime = 'image/jpeg';
    }
    
    return `data:${mime};base64,${base64}`;
}

/**
 * Validates a URL for security.
 */
export function validateUrl(url: string) {
    if (!url) throw new Error("URL is required");
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
        throw new Error("Only HTTPS URLs are allowed");
    }
}

/**
 * Download a remote image to a temporary location.
 * Returns the URI and a cleanup function.
 */
export async function downloadRemoteImage(url: string): Promise<{ uri: string; cleanup: () => Promise<void> }> {
    validateUrl(url);

    const result = await getPlatformAdapters().fileSystem.downloadToTemp(url);

    try {
        const size = await getFileSize(result.path);
        if (size > MAX_FILE_SIZE) {
            throw new Error("File too large");
        }
        return { uri: result.path, cleanup: result.cleanup };
    } catch (e) {
        await result.cleanup();
        throw e;
    }
}

/** Delete a file from local storage */
export async function deleteFile(localPath: string): Promise<void> {
    const absoluteUri = await resolveLocalUri(localPath);
    await getPlatformAdapters().fileSystem.deleteFile(absoluteUri).catch(() => { });
}

/** Get file size in bytes */
export async function getFileSize(localPath: string): Promise<number> {
    const absoluteUri = await resolveLocalUri(localPath);
    return await getPlatformAdapters().fileSystem.getSize(absoluteUri).catch(() => 0);
}

// ============ DEVICE INTEGRATION ============

/**
 * Saves a given file to the device's native gallery (if image) or shares it (if PDF).
 */
export async function saveFile(fileId?: string, base64Uri?: string): Promise<boolean> {
    try {
        const hasPermission = await getPlatformAdapters().image.requestGalleryPermission();
        if (!hasPermission) {
            console.log('No permission to save images to gallery');
            return false;
        }

        let localUri = '';

        if (fileId) {
            const webpPath = await resolveLocalUri(`${fileId}.webp`);
            let size = await getFileSize(webpPath);
            if (size > 0) {
                localUri = webpPath;
            } else {
                const jpgPath = await resolveLocalUri(`${fileId}.jpg`);
                size = await getFileSize(jpgPath);
                if (size > 0) {
                    localUri = jpgPath;
                }
            }
        }

        if (!localUri && base64Uri && base64Uri.startsWith('data:image/')) {
            const base64Data = base64Uri.replace(/^data:image\/\w+;base64,/, "");
            const tempDir = await getPlatformAdapters().fileSystem.ensureDir('cache');
            const separator = tempDir.endsWith('/') ? '' : '/';
            localUri = `${tempDir}${separator}download-${Date.now()}.jpg`;

            const rawBytes = Buffer.from(base64Data, 'base64');
            await getPlatformAdapters().fileSystem.writeBytes(localUri, rawBytes);
        }

        if (!localUri) {
            console.error('No valid image source found to save.');
            return false;
        }

        await getPlatformAdapters().image.saveToGallery(localUri);
        console.log('Image successfully saved to gallery!');
        return true;
    } catch (e) {
        console.error('Failed to save image to gallery', e);
        return false;
    }
}
