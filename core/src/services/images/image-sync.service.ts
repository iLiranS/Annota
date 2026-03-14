import { encode } from 'base64-arraybuffer';
import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../../adapters';
import { storageApi } from '../../api/storage.api';
import * as ImagesRepo from '../../db/repositories/images.repository';
import type { ImageInsert } from '../../db/schema';
import { useSyncStore } from '../../stores/sync.store';
import { decryptImageBytes, deriveAesKey, encryptImageBytes } from '../../utils/crypto';
import { resolveLocalUri } from './image.service';

const BUCKET_NAME = 'e2e_images';
const MAX_CONCURRENT_DOWNLOADS = 3;

export interface QueueItem {
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
        // 1. Get/Derive the AES key
        const { aesKey, activeMnemonic, setAesKey } = useSyncStore.getState();
        const currentKey = (aesKey && activeMnemonic === masterKey)
            ? aesKey
            : Buffer.from(deriveAesKey(masterKey));

        // 2. Update the store if we derived a new one
        if (activeMnemonic !== masterKey) {
            setAesKey(masterKey, currentKey);
        }

        const candidates = await ImagesRepo.getPendingImagesLinkedToLatestVersions();

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
                        const absoluteUri = await resolveLocalUri(image.localPath);
                        rawBytes = await getPlatformAdapters().fileSystem.readBytes(absoluteUri);
                    } catch (e) {
                        console.warn(`[ImageSync] Could not read file for image ${image.id} at ${image.localPath}. Skipping.`, e);
                        continue; // file doesn't exist or unreadable
                    }

                    // 2. Encrypt raw bytes directly
                    const { encryptedBytes, nonce } = await encryptImageBytes(rawBytes, currentKey);

                    // 3. Upload encrypted bytes to Storage
                    const storagePath = `${userId}/${image.id}`;
                    const uploadBuffer = encryptedBytes.buffer.slice(
                        encryptedBytes.byteOffset,
                        encryptedBytes.byteOffset + encryptedBytes.byteLength,
                    ) as ArrayBuffer;

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
                await ImagesRepo.markImagesAsSynced(pushedImageIds);
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

        const latestImageStateByNote = await ImagesRepo.getLatestVersionImageIdsForNotes(noteIdsNeedingReplace);
        for (const { noteId, imageIds } of latestImageStateByNote) {
            try {
                // Only reference images that have been successfully pushed (exist in encrypted_images)
                const syncedImageIds = imageIds.length > 0
                    ? (await ImagesRepo.getImagesByIds(imageIds))
                        .filter(img => img.syncStatus === 'synced')
                        .map(img => img.id)
                    : [];

                const { error } = await storageApi.replaceE2ENoteImages(noteId, userId, syncedImageIds);

                if (error) {
                    //Catch Postgres Foreign Key Violation for missing images - auto heal
                    if (error.code === '23503' && error.message?.includes('note_images_image_id_fkey')) {
                        console.warn(`[ImageSync] Remote DB missing images for note ${noteId}. Reverting local status to pending to force re-upload.`);

                        if (syncedImageIds.length > 0) {
                            await ImagesRepo.revertImagesToPending(syncedImageIds);
                        }
                    }
                    throw error;
                }
            } catch (err) {
                console.error(`[ImageSync] Failed to replace note_images for note ${noteId}`, err);
            }
        }
    }

    async retryPendingDownloads(masterKey: string, userId: string) {
        const pendingItems = await ImagesRepo.getPendingDownloads();
        if (pendingItems.length > 0) {
            console.log(`[ImageSync] Retrying ${pendingItems.length} pending downloads...`);
            // Re-inject the masterKey since we couldn't store it in the DB
            const itemsToQueue: QueueItem[] = pendingItems.map(p => ({
                ...p,
                masterKey,
                userId
            }));
            this.queueImagesForDownload(itemsToQueue);
        }
    }

    /**
     * Add images to download queue and start processing
     */
    async queueImagesForDownload(items: QueueItem[]) {
        if (items.length === 0) return;

        // 1. Persist intention to local DB FIRST (Safety Net)
        // We only save the non-sensitive data needed to identify the file
        const dbQueueItems = items.map(({ imageId, noteId, nonce, userId }) => ({
            imageId, noteId, nonce, userId
        }));
        await ImagesRepo.upsertDownloadQueue(dbQueueItems);

        // 2. Prevent adding duplicates to the active in-memory queue
        const existingIds = new Set(this.downloadQueue.map(q => q.imageId));
        const newItems = items.filter(item => !existingIds.has(item.imageId));

        this.downloadQueue.push(...newItems);
        this.processQueue();
    }

    private async processQueue() {
        if (this.isDownloading || this.downloadQueue.length === 0) return;
        this.isDownloading = true;

        while (this.downloadQueue.length > 0) {
            const slotsAvailable = MAX_CONCURRENT_DOWNLOADS - this.activeDownloads;

            if (slotsAvailable <= 0) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            // PEEK at the batch, do NOT remove them with splice yet!
            // If the app crashes right here, splice would have destroyed the memory queue.
            const batch = this.downloadQueue.slice(0, slotsAvailable);
            this.activeDownloads += batch.length;

            // Process batch concurrently
            await Promise.all(batch.map(async (item) => {
                const success = await this.downloadSingleImage(item);

                // Regardless of success or failure, remove from the immediate in-memory 
                // queue so we don't get stuck in an infinite loop right now.
                this.downloadQueue = this.downloadQueue.filter(q => q.imageId !== item.imageId);

                if (success) {
                    // If successful, remove it from the persistent local DB queue
                    await ImagesRepo.removeFromDownloadQueue(item.imageId);
                }
                // If it failed, it stays in the DB queue to be picked up by 
                // retryPendingDownloads() later.
            }));

            this.activeDownloads -= batch.length;
        }

        this.isDownloading = false;
    }

    private async downloadSingleImage(item: QueueItem): Promise<boolean> {
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

            // 1. Get/Derive the AES key
            const { aesKey, activeMnemonic, setAesKey } = useSyncStore.getState();
            const currentKey = (aesKey && activeMnemonic === item.masterKey)
                ? aesKey
                : Buffer.from(deriveAesKey(item.masterKey));

            // 2. Update the store if we derived a new one
            if (activeMnemonic !== item.masterKey) {
                setAesKey(item.masterKey, currentKey);
            }

            // Decrypt → raw bytes
            const decryptedBytes = await decryptImageBytes(encryptedBytes, item.nonce, currentKey);

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
                const rawBytes = Buffer.from(base64String, 'base64');
                fileExt = 'jpg';
                fileBytes = new Uint8Array(rawBytes);
            }

            // Write to disk
            const separator = imagesDir.endsWith('/') ? '' : '/';
            const newLocalPath = `${imagesDir}${separator}${item.imageId}.${fileExt}`;
            await getPlatformAdapters().fileSystem.writeBytes(newLocalPath, fileBytes);
            const fileSize = await getPlatformAdapters().fileSystem.getSize(newLocalPath);

            // Construct minimal image record
            const newImage: ImageInsert = {
                id: item.imageId,
                localPath: `${item.imageId}.${fileExt}`, // Store only relative filename
                size: fileSize,
                syncStatus: 'synced',
                createdAt: new Date(),
            };

            // Save to DB
            const existing = await ImagesRepo.getImageById(newImage.id);
            const existingRecord = Array.isArray(existing) ? existing[0] : existing;

            // Explicitly check for the primary key (id) to filter out the ghost object
            if (!existingRecord || !existingRecord.id) {
                await ImagesRepo.insertImage(newImage);
            } else if (existingRecord.syncStatus !== 'synced') {
                await ImagesRepo.markImagesAsSynced([newImage.id]);
            }

            console.log(`[ImageSync] Downloaded and synced image ${item.imageId} (${isRawBinary ? 'binary' : 'legacy'})`);
            return true
        } catch (error) {
            console.error(`[ImageSync] Error downloading image ${item.imageId}`, error);
            return false
        }
    }
}

export const imageSyncService = new ImageSyncService();
