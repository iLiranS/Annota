import * as Crypto from 'expo-crypto';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat, type ImageResult } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';

// ============ CONSTANTS ============

const IMAGES_DIR_NAME = 'images';
const MAX_IMAGE_WIDTH = 1920;
const JPEG_QUALITY = 0.8;

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
 * Resize and compress an image to JPEG.
 * Uses the expo-image-manipulator v14 object-oriented API.
 */
export async function resizeAndCompress(uri: string): Promise<ImageResult> {
    const context = ImageManipulator.manipulate(uri);
    const imageRef = await context.resize({ width: MAX_IMAGE_WIDTH }).renderAsync();
    const result = await imageRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: JPEG_QUALITY,
    });
    return result;
}

/**
 * Compute SHA-256 hash of a file's contents.
 * Reads as base64 then hashes — ensures consistent hashing after resize.
 */
export async function computeHash(fileUri: string): Promise<string> {
    const file = new ExpoFile(fileUri);
    const base64 = await file.base64();
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
}

/**
 * Save an image file to the local images directory.
 * Returns the final local path (URI).
 */
export function saveToLocalStorage(sourceUri: string, imageId: string): string {
    const dir = getImagesDirectory();
    const destFile = new ExpoFile(dir, `${imageId}.jpg`);
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
    return `data:image/jpeg;base64,${base64}`;
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
 * Saves a given base64 data URI to the device's native gallery.
 */
export async function saveBase64ToGallery(base64Uri: string): Promise<boolean> {
    try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            console.log('No permission to save images to gallery');
            return false;
        }

        let localUri = base64Uri;

        if (base64Uri.startsWith('data:image/')) {
            const base64Data = base64Uri.replace(/^data:image\/\w+;base64,/, "");
            const tempDir = new Directory(Paths.cache, 'download');
            tempDir.create({ idempotent: true, intermediates: true });
            const tempFile = new ExpoFile(tempDir, `download-${Date.now()}.jpg`);
            try {
                tempFile.create({ overwrite: true, intermediates: true });
                tempFile.write(base64Data, { encoding: 'base64' });
            } catch {
                await LegacyFileSystem.writeAsStringAsync(tempFile.uri, base64Data, {
                    encoding: LegacyFileSystem.EncodingType.Base64,
                });
            }
            localUri = tempFile.uri;
        }

        await MediaLibrary.saveToLibraryAsync(localUri);
        console.log('Image successfully saved to gallery!');
        return true;
    } catch (e) {
        console.error('Failed to save image to gallery', e);
        return false;
    }
}

