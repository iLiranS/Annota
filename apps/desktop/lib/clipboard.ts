import { Image } from "@tauri-apps/api/image";
import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * Enhanced clipboard utility for images and text.
 * Generates a "Rich Payload" (PNG + HTML) and securely passes it to the OS clipboard
 * using Promise-based resolution to bypass Transient User Activation limits.
 */
export function copyImageToClipboard(src: string, imageId?: string): Promise<boolean> {
    if (!src) return Promise.resolve(false);

    try {
        // 1. Prepare the HTML metadata as an immediate Promise
        const htmlPromise = Promise.resolve(
            new Blob([`<img src="${src}" data-image-id="${imageId || ''}" />`], { type: "text/html" })
        );

        // 2. Prepare the Image generation as an async Promise (Do NOT await it here!)
        const pngPromise = (async () => {
            let objectUrl = src;

            if (!src.startsWith('data:image')) {
                const response = await fetch(src);
                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
            }

            const img = new window.Image();
            img.src = objectUrl;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");
            ctx.drawImage(img, 0, 0);

            const pngBlob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Canvas failed")), 'image/png');
            });

            if (objectUrl !== src) URL.revokeObjectURL(objectUrl);
            return pngBlob;
        })();

        // 3. Construct the ClipboardItem using the PROMISES, not the finalized Blobs
        const clipboardItem = new ClipboardItem({
            "text/html": htmlPromise,
            "image/png": pngPromise
        });

        // 4. Execute the write IMMEDIATELY to lock in the user gesture permission!
        return navigator.clipboard.write([clipboardItem])
            .then(() => true)
            .catch(async (nativeError) => {
                console.warn("Native clipboard blocked, using Tauri fallback:", nativeError);

                // Fallback: If the browser strictly denies it, let Tauri's native rust backend handle it.
                // (This loses HTML metadata, but guarantees external app pasting still works)
                try {
                    const blob = await pngPromise;
                    const arrayBuffer = await blob.arrayBuffer();
                    const tauriImage = await Image.fromBytes(new Uint8Array(arrayBuffer));
                    await writeImage(tauriImage);
                    return true;
                } catch (tauriError) {
                    console.error("Tauri fallback failed:", tauriError);
                    await writeText(`[Image: ${imageId || 'Attachment'}]`);
                    return false;
                }
            });

    } catch (error) {
        console.error("Failed to construct clipboard item:", error);
        // Synchronous final fallback
        writeText(`[Image: ${imageId || 'Attachment'}]`).catch(console.error);
        return Promise.resolve(false);
    }
}

export { writeText } from "@tauri-apps/plugin-clipboard-manager";
