import * as Clipboard from 'expo-clipboard';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';

/**
 * Mobile clipboard utility for copying images.
 * Reads local files to Base64 and pushes them to the iOS/Android image clipboard.
 */
export async function copyImageToClipboardMobile(src: string, imageId?: string): Promise<boolean> {
    if (!src) return false;

    try {
        let base64Data = "";

        if (src.startsWith('data:image')) {
            // Extract base64 from the data URI
            base64Data = src.replace(/^data:image\/\w+;base64,/, "");
        } else {
            // Check if the path is a valid URI (for Expo FileSystem)
            // Note: asset:// becomes file:// or we might need to resolve it 
            // but usually incoming src from NoteImageService on mobile will be a persistent file URI.
            const fileUri = src.startsWith('file://') ? src : (src.startsWith('/') ? `file://${src}` : src);

            // Use legacy API to get Base64 string directly
            base64Data = await readAsStringAsync(fileUri, {
                encoding: EncodingType.Base64,
            });
        }

        // Write the pure image data to the native mobile clipboard
        await Clipboard.setImageAsync(base64Data);

        // Optional: Save the ID to a temporary global memory state for internal deduplication
        if (imageId) {
            (global as any).lastCopiedMobileImageId = imageId;
        }

        return true;

    } catch (error) {
        console.error("Failed to copy image on mobile:", error);
        // Fallback to cleaner internal reference format
        await Clipboard.setStringAsync(`[[ImageID:${imageId || 'Attachment'}]]`);
        return false;
    }
}
