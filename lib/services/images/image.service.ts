import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat, type ImageResult } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import crypto from 'react-native-quick-crypto';

// ============ CONSTANTS ============

const IMAGES_DIR_NAME = 'images';
const MAX_DIMENSION = 1500;
const WEBP_QUALITY = 0.8;

// ============ DIRECTORY MANAGEMENT ============

/** Returns the images directory, creating it if needed */
export function getImagesDirectory(): Directory {
    const dir = new Directory(Paths.document, IMAGES_DIR_NAME);
    if (!dir.exists) {
        dir.create();
    }
    return dir;
}

// ============ IMAGE PROCESSING ============

/**
 * Resize and compress an image to WEBP.
 * Targets the long edge to MAX_DIMENSION (landscape → width, portrait → height).
 * Skips resize if both dimensions are already within limits.
 */
export async function resizeAndCompress(uri: string): Promise<ImageResult> {
    const context = ImageManipulator.manipulate(uri);

    // Render once to get original dimensions
    const original = await context.renderAsync();
    const { width: origW, height: origH } = await original.saveAsync({ format: SaveFormat.WEBP, compress: 1 });

    let manipulated = ImageManipulator.manipulate(uri);

    if (origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
        // Resize the long edge; expo-image-manipulator auto-computes the other
        if (origW >= origH) {
            manipulated = manipulated.resize({ width: MAX_DIMENSION });
        } else {
            manipulated = manipulated.resize({ height: MAX_DIMENSION });
        }
    }

    const rendered = await manipulated.renderAsync();
    return rendered.saveAsync({
        format: SaveFormat.WEBP,
        compress: WEBP_QUALITY,
    });
}

/**
 * Compute SHA-256 hash of a file's contents.
 * Reads as base64 then hashes — ensures consistent hashing after resize.
 */
export async function computeHash(fileUri: string): Promise<string> {
    const file = new ExpoFile(fileUri);
    const base64 = await file.base64();
    const hash = crypto.createHash('sha256');
    hash.update(base64, 'utf8');
    return hash.digest('hex') as unknown as string;
}

/**
 * Save an image file to the local images directory.
 * Returns the final local path (URI).
 */
export function saveToLocalStorage(sourceUri: string, imageId: string): string {
    const dir = getImagesDirectory();
    const destFile = new ExpoFile(dir, `${imageId}.webp`);
    const sourceFile = new ExpoFile(sourceUri);
    sourceFile.copy(destFile);
    return destFile.uri;
}

/**
 * Read an image file as a base64 data URI for WebView injection.
 * Returns `data:image/jpeg;base64,...`
 */
export async function readAsBase64DataUri(localPath: string): Promise<string> {
    const file = new ExpoFile(localPath);
    const base64 = await file.base64();
    // Detect MIME from extension — legacy .jpg files still need to work
    const mime = localPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
}

/**
 * Download a remote image to a temporary file.
 * Returns the URI and a cleanup function.
 */
export async function downloadRemoteImage(url: string): Promise<{ uri: string; cleanup: () => void }> {
    const tempDir = new Directory(Paths.cache, 'downloads');
    if (!tempDir.exists) {
        tempDir.create();
    }
    const downloaded = await ExpoFile.downloadFileAsync(url, tempDir);
    return {
        uri: downloaded.uri,
        cleanup: () => { try { downloaded.delete(); } catch { /* ignore */ } },
    };
}

/** Delete an image file from local storage */
export function deleteImageFile(localPath: string): void {
    const file = new ExpoFile(localPath);
    if (file.exists) {
        file.delete();
    }
}

/** Get file size in bytes */
export function getFileSize(localPath: string): number {
    const file = new ExpoFile(localPath);
    return file.size;
}

// ============ DEVICE INTEGRATION ============

/**
 * Saves a given image to the device's native gallery.
 * Prefers using the existing local file via imageId if available.
 * Falls back to extracting logic from the base64 URI if needed.
 */
export async function saveImageToGallery(imageId?: string, base64Uri?: string): Promise<boolean> {
    try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            console.log('No permission to save images to gallery');
            return false;
        }

        let localUri = '';

        if (imageId) {
            const dir = getImagesDirectory();
            // Try .webp first, fall back to legacy .jpg
            let file = new ExpoFile(dir, `${imageId}.webp`);
            if (!file.exists) {
                file = new ExpoFile(dir, `${imageId}.jpg`);
            }
            if (file.exists) {
                const ext = file.uri.endsWith('.webp') ? 'webp' : 'jpg';
                const tempFileUri = LegacyFileSystem.cacheDirectory + `download-${Date.now()}.${ext}`;
                await LegacyFileSystem.copyAsync({
                    from: file.uri,
                    to: tempFileUri
                });
                localUri = tempFileUri;
            }
        }

        if (!localUri && base64Uri && base64Uri.startsWith('data:image/')) {
            const base64Data = base64Uri.replace(/^data:image\/\w+;base64,/, "");
            const tempFileUri = LegacyFileSystem.cacheDirectory + `download-${Date.now()}.jpg`;
            await LegacyFileSystem.writeAsStringAsync(tempFileUri, base64Data, {
                encoding: LegacyFileSystem.EncodingType.Base64,
            });
            localUri = tempFileUri;
        }

        if (!localUri) {
            console.error('No valid image source found to save.');
            return false;
        }

        await MediaLibrary.saveToLibraryAsync(localUri);
        console.log('Image successfully saved to gallery!');
        return true;
    } catch (e) {
        console.error('Failed to save image to gallery', e);
        return false;
    }
}

