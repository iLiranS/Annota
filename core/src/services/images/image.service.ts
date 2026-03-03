import { getPlatformAdapters } from '../../adapters';

// ============ CONSTANTS ============

const MAX_DIMENSION = 1500;
const WEBP_QUALITY = 0.8;

// ============ DIRECTORY MANAGEMENT ============

export async function getImagesDirectory(): Promise<string> {
    return await getPlatformAdapters().fileSystem.ensureDir('images');
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
    const base64 = await getPlatformAdapters().fileSystem.readBase64(localPath);
    // Detect MIME from extension — legacy .jpg files still need to work
    const mime = localPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
}

/**
 * Download a remote image to a temporary file.
 * Returns the URI and a cleanup function.
 */
export async function downloadRemoteImage(url: string): Promise<{ uri: string; cleanup: () => Promise<void> }> {
    const result = await getPlatformAdapters().fileSystem.downloadToTemp(url);
    return { uri: result.path, cleanup: result.cleanup };
}

/** Delete an image file from local storage */
export async function deleteImageFile(localPath: string): Promise<void> {
    await getPlatformAdapters().fileSystem.deleteFile(localPath).catch(() => { });
}

/** Get file size in bytes */
export async function getFileSize(localPath: string): Promise<number> {
    return await getPlatformAdapters().fileSystem.getSize(localPath).catch(() => 0);
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
            const dir = await getImagesDirectory();
            const separator = dir.endsWith('/') ? '' : '/';
            const webpPath = `${dir}${separator}${imageId}.webp`;
            let size = await getFileSize(webpPath);
            if (size > 0) {
                localUri = webpPath;
            } else {
                const jpgPath = `${dir}${separator}${imageId}.jpg`;
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

            const binaryString = atob(base64Data);
            const rawBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                rawBytes[i] = binaryString.charCodeAt(i);
            }
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
