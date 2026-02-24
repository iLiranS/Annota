import * as ImagesRepo from '@/lib/db/repositories/images.repository';
import { supabase } from '@/lib/supabase';
import { decryptImageBytes, encryptImageBytes } from '@/lib/utils/crypto';
import { getDb } from '@/stores/db-store';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';

const BUCKET_NAME = 'e2e_images';
const MAX_CONCURRENT_DOWNLOADS = 3;

interface QueueItem {
    imageId: string;
    noteId: string;
    nonce: string;
    masterKey: string;
    userId: string;
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

            for (const image of uniquePendingImages.values()) {
                try {
                    // 1. Read file from disk as raw bytes
                    const file = new ExpoFile(image.localPath);
                    if (!file.exists) continue;

                    const rawBytes = await file.bytes();

                    // 2. Encrypt raw bytes directly
                    const { encryptedBytes, nonce } = encryptImageBytes(rawBytes, masterKey);

                    // 3. Upload encrypted bytes to Storage
                    const storagePath = `${userId}/${image.id}`;
                    const uploadBuffer = encryptedBytes.buffer.slice(
                        encryptedBytes.byteOffset,
                        encryptedBytes.byteOffset + encryptedBytes.byteLength,
                    ) as ArrayBuffer;
                    const { error: uploadError } = await supabase.storage
                        .from(BUCKET_NAME)
                        .upload(storagePath, uploadBuffer, {
                            contentType: 'application/octet-stream',
                            upsert: true,
                        });

                    if (uploadError) throw uploadError;

                    // 4. Insert Metadata into DB
                    const { error: metaError } = await supabase
                        .from('encrypted_images')
                        .upsert({
                            id: image.id,
                            user_id: userId,
                            nonce,
                            created_at: new Date().toISOString(),
                        });

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

                const { error } = await supabase.rpc('replace_note_images', {
                    p_note_id: noteId,
                    p_user_id: userId,
                    p_image_ids: syncedImageIds,
                });

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
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .download(storagePath);

            if (error || !data) throw error || new Error('No data returned');

            // Convert blob → Uint8Array
            const arrayBuffer = await data.arrayBuffer();
            const encryptedBytes = new Uint8Array(arrayBuffer);

            // Decrypt → raw image bytes
            const decryptedBytes = decryptImageBytes(encryptedBytes, item.nonce, item.masterKey);

            // Ensure images directory exists
            const imagesDir = new Directory(Paths.document, 'images');
            if (!imagesDir.exists) {
                imagesDir.create();
            }

            // Write raw bytes to disk as .webp
            const destFile = new ExpoFile(imagesDir, `${item.imageId}.webp`);
            destFile.create({ overwrite: true });
            destFile.write(decryptedBytes);

            const newLocalPath = destFile.uri;

            // Construct minimal image record
            const newImage: Parameters<typeof ImagesRepo.insertImage>[0] = {
                id: item.imageId,
                localPath: newLocalPath,
                size: destFile.size,
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

            console.log(`[ImageSync] Downloaded and synced image ${item.imageId}`);
        } catch (error) {
            console.error(`[ImageSync] Error downloading image ${item.imageId}`, error);
        }
    }
}

export const imageSyncService = new ImageSyncService();
