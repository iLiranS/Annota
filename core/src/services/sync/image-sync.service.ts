import { getPlatformAdapters } from '../../adapters';
import { storageApi } from '../../api/storage.api';
import * as ImagesRepo from '../../db/repositories/images.repository';
import { getDb } from '../../stores/db.store';
import { decryptImageBytes, encryptImageBytes } from '../../utils/crypto';

const BUCKET_NAME = 'e2e_images';
const MAX_CONCURRENT_DOWNLOADS = 3;

interface QueueItem {
    imageId: string;
    noteId: string;
    nonce: string;
    masterKey: string;
    userId: string;
}

/** Check if the first bytes match known image format magic bytes */
function detectImageMagicBytes(bytes: Uint8Array): boolean {
    if (bytes.length < 4) return false;
    // WEBP: starts with "RIFF"
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
    // JPEG: starts with 0xFF 0xD8
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return true;
    // PNG: starts with 0x89 0x50 0x4E 0x47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    return false;
}

class ImageSyncService {
    private isDownloading: boolean = false;
    private downloadQueue: QueueItem[] = [];
    private activeDownloads: number = 0;

    /**
     * Push pending images linked to HEAD versions of notes up to Supabase.
     */
    async pushImages(masterKey: string, userId: string, noteIdsToRefresh: string[] = []): Promise<void> {
        const candidates = ImagesRepo.getPendingImagesLinkedToLatestVersions();

        const notesWithPendingImages = new Set(candidates.map(c => c.noteId));
        const uniquePendingImages = new Map(candidates.map(c => [c.image.id, c.image]));

        if (uniquePendingImages.size > 0) {
            console.log(`[ImageSync] Found ${uniquePendingImages.size} unique pending images for push.`);

            const pushedImageIds: string[] = [];
            const pendingImagesList = Array.from(uniquePendingImages.values());

            for (const image of pendingImagesList) {
                try {
                    // 1. Read file from disk as raw bytes
                    let rawBytes: Uint8Array;
                    try {
                        rawBytes = await getPlatformAdapters().fileSystem.readBytes(image.localPath);
                    } catch (e) {
                        continue; // file doesn't exist or unreadable
                    }

                    // 2. Encrypt raw bytes directly
                    const { encryptedBytes, nonce } = encryptImageBytes(rawBytes, masterKey);

                    // 3. Upload encrypted bytes to Storage
                    const storagePath = `${userId}/${image.id}`;
                    const uploadBuffer = encryptedBytes.buffer.slice(
                        encryptedBytes.byteOffset,
                        encryptedBytes.byteOffset + encryptedBytes.byteLength,
                    ) as ArrayBuffer;

                    const { encode } = require('base64-arraybuffer');
                    const base64Data = encode(uploadBuffer);

                    const { error: uploadError } = await storageApi.uploadImage(storagePath, base64Data, 'application/octet-stream', BUCKET_NAME);

                    if (uploadError) throw uploadError;

                    // 4. Insert Metadata into DB
                    const { error: metaError } = await storageApi.upsertEncryptedImage(image.id, userId, nonce);

                    if (metaError) throw metaError;

                    pushedImageIds.push(image.id);
                } catch (err) {
                    console.error(`[ImageSync] Failed to push image ${image.id}`, err);
                }
            }

            // 5. Update local DB
            if (pushedImageIds.length > 0) {
                ImagesRepo.markImagesAsSynced(pushedImageIds);
                console.log(`[ImageSync] Successfully pushed ${pushedImageIds.length} images.`);
            }
        }

        const noteIdsNeedingReplace = Array.from(new Set([
            ...noteIdsToRefresh,
            ...Array.from(notesWithPendingImages),
        ]));

        if (noteIdsNeedingReplace.length === 0) {
            return;
        }

        const latestImageStateByNote = ImagesRepo.getLatestVersionImageIdsForNotes(noteIdsNeedingReplace);
        for (const { noteId, imageIds } of latestImageStateByNote) {
            try {
                // Only reference images that have been successfully pushed (exist in encrypted_images)
                const syncedImageIds = imageIds.length > 0
                    ? ImagesRepo.getImagesByIds(imageIds)
                        .filter(img => img.syncStatus === 'synced')
                        .map(img => img.id)
                    : [];

                const { error } = await storageApi.replaceE2ENoteImages(noteId, userId, syncedImageIds);

                if (error) throw error;
            } catch (err) {
                console.error(`[ImageSync] Failed to replace note_images for note ${noteId}`, err);
            }
        }
    }

    /**
     * Add images to download queue and start processing
     */
    queueImagesForDownload(items: QueueItem[]) {
        this.downloadQueue.push(...items);
        this.processQueue();
    }

    private async processQueue() {
        if (this.isDownloading || this.downloadQueue.length === 0) return;
        this.isDownloading = true;

        while (this.downloadQueue.length > 0) {
            // Fill available slots
            const slotsAvailable = MAX_CONCURRENT_DOWNLOADS - this.activeDownloads;
            const batch = this.downloadQueue.splice(0, slotsAvailable);

            if (batch.length === 0) {
                // Wait briefly if we are full but still have queue
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            this.activeDownloads += batch.length;

            // Process batch concurrently
            Promise.all(batch.map(item => this.downloadSingleImage(item)))
                .finally(() => {
                    this.activeDownloads -= batch.length;
                });
        }

        this.isDownloading = false;
    }

    private async downloadSingleImage(item: QueueItem) {
        try {
            const storagePath = `${item.userId}/${item.imageId}`;

            // Download encrypted blob from Supabase
            const { data, error } = await storageApi.downloadImage(storagePath, BUCKET_NAME);

            if (error || !data) throw error || new Error('No data returned');

            // Convert blob → ArrayBuffer via FileReader (RN Blob lacks .arrayBuffer())
            const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = reject;
                reader.readAsArrayBuffer(data);
            });
            const encryptedBytes = new Uint8Array(arrayBuffer);

            // Decrypt → raw bytes
            const decryptedBytes = decryptImageBytes(encryptedBytes, item.nonce, item.masterKey);

            // Ensure images directory exists
            const imagesDir = await getPlatformAdapters().fileSystem.ensureDir('images');

            // Detect if the decrypted data is raw binary (new format) or base64 text (legacy).
            // Raw images start with known magic bytes; base64 text is pure ASCII.
            const isRawBinary = detectImageMagicBytes(decryptedBytes);

            let fileExt: string;
            let fileBytes: Uint8Array;

            if (isRawBinary) {
                // New format: decrypted bytes ARE the image
                fileExt = 'webp';
                fileBytes = decryptedBytes;
            } else {
                // Legacy format: decrypted bytes are a base64-encoded string
                const base64String = new TextDecoder().decode(decryptedBytes);
                const binaryString = atob(base64String);
                const rawBytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    rawBytes[i] = binaryString.charCodeAt(i);
                }
                fileExt = 'jpg';
                fileBytes = rawBytes;
            }

            // Write to disk
            const separator = imagesDir.endsWith('/') ? '' : '/';
            const newLocalPath = `${imagesDir}${separator}${item.imageId}.${fileExt}`;
            await getPlatformAdapters().fileSystem.writeBytes(newLocalPath, fileBytes);
            const fileSize = await getPlatformAdapters().fileSystem.getSize(newLocalPath);

            // Construct minimal image record
            const newImage: Parameters<typeof ImagesRepo.insertImage>[0] = {
                id: item.imageId,
                localPath: newLocalPath,
                size: fileSize,
                syncStatus: 'synced',
                createdAt: new Date(),
            };

            // Save to DB
            getDb().transaction(tx => {
                const existing = ImagesRepo.getImageById(newImage.id, tx);
                if (!existing) {
                    ImagesRepo.insertImage(newImage, tx);
                } else if (existing.syncStatus !== 'synced') {
                    ImagesRepo.markImagesAsSynced([newImage.id], tx);
                }
            });

            console.log(`[ImageSync] Downloaded and synced image ${item.imageId} (${isRawBinary ? 'binary' : 'legacy'})`);
        } catch (error) {
            console.error(`[ImageSync] Error downloading image ${item.imageId}`, error);
        }
    }
}

export const imageSyncService = new ImageSyncService();
