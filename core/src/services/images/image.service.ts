import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../../adapters';

// ============ CONSTANTS ============

const MAX_DIMENSION = 1500;
const WEBP_QUALITY = 0.8;
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

// ============ DIRECTORY MANAGEMENT ============

export async function getImagesDirectory(): Promise<string> {
    return await getPlatformAdapters().fileSystem.ensureDir('images');
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
    // to the images directory before they are actually saved there.
    if (storedPath.startsWith('/') || storedPath.startsWith('file://')) {
        return storedPath;
    }

    // Otherwise, assume it's a filename relative to the persistent images directory.
    let filename = storedPath;
    if (storedPath.includes('/') || storedPath.includes('\\')) {
        filename = storedPath.split(/[/\\]/).pop() || storedPath;
    }

    const dir = await getImagesDirectory();
    const separator = dir.endsWith('/') ? '' : '/';
    return `${dir}${separator}${filename}`;
}

// ============ IMAGE PROCESSING ============

/**
 * Resize and compress an image to WEBP.
 * Targets the long edge to MAX_DIMENSION (landscape → width, portrait → height).
 * Skips resize if both dimensions are already within limits.
 */
export async function resizeAndCompress(uri: string): Promise<{ uri: string; width: number; height: number }> {
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
 * Save an image file to the local images directory.
 * Returns the final local path (URI).
 */
export async function saveToLocalStorage(sourceUri: string, imageId: string): Promise<string> {
    const dir = await getImagesDirectory();
    // Normalize path just in case
    const separator = dir.endsWith('/') ? '' : '/';
    const destPath = `${dir}${separator}${imageId}.webp`;
    await getPlatformAdapters().fileSystem.copyFile(sourceUri, destPath);
    return destPath;
}

/**
 * Read an image file as a base64 data URI for WebView injection.
 * Returns `data:image/jpeg;base64,...`
 */
export async function readAsBase64DataUri(localPath: string): Promise<string> {
    const absoluteUri = await resolveLocalUri(localPath);
    const base64 = await getPlatformAdapters().fileSystem.readBase64(absoluteUri);
    // Detect MIME from extension — legacy .jpg files still need to work
    const mime = absoluteUri.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
}

/**
 * Validates a URL for security.
 */
export function validateUrl(url: string) {
    if (!url) throw new Error("URL is required");
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
        throw new Error("Only HTTPS images are allowed");
    }
}

/**
 * Download a remote image to a temporary file.
 * Returns the URI and a cleanup function.
 */
export async function downloadRemoteImage(url: string): Promise<{ uri: string; cleanup: () => Promise<void> }> {
    validateUrl(url);

    const result = await getPlatformAdapters().fileSystem.downloadToTemp(url);

    try {
        // Double check size after download as a final safety measure
        // We use result.path directly as it's absolute
        const size = await getFileSize(result.path);
        if (size > MAX_IMAGE_SIZE) {
            throw new Error("Image too large");
        }
        return { uri: result.path, cleanup: result.cleanup };
    } catch (e) {
        // Ensure we clean up if something goes wrong after download
        await result.cleanup();
        throw e;
    }
}

/** Delete an image file from local storage */
export async function deleteImageFile(localPath: string): Promise<void> {
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
 * Saves a given image to the device's native gallery.
 * Prefers using the existing local file via imageId if available.
 * Falls back to extracting logic from the base64 URI if needed.
 */
export async function saveImageToGallery(imageId?: string, base64Uri?: string): Promise<boolean> {
    try {
        const hasPermission = await getPlatformAdapters().image.requestGalleryPermission();
        if (!hasPermission) {
            console.log('No permission to save images to gallery');
            return false;
        }

        let localUri = '';

        if (imageId) {
            const webpPath = await resolveLocalUri(`${imageId}.webp`);
            let size = await getFileSize(webpPath);
            if (size > 0) {
                localUri = webpPath;
            } else {
                const jpgPath = await resolveLocalUri(`${imageId}.jpg`);
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
