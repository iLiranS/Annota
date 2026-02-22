import * as ImagesRepo from '@/lib/db/repositories/images.repository';
import { supabase } from '@/lib/supabase';
import { decryptImagePayload, encryptImagePayload } from '@/lib/utils/crypto';
import { getDb } from '@/stores/db-store';
import { decode } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

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
    async pushImages(masterKey: string, userId: string): Promise<void> {
        const candidates = ImagesRepo.getPendingImagesLinkedToLatestVersions();
        if (candidates.length === 0) return;

        console.log(`[ImageSync] Found ${candidates.length} candidate images for push.`);

        const pushedImageIds: string[] = [];

        for (const { image, noteId } of candidates) {
            try {
                // 1. Read file from disk as Base64
                const fileInfo = await FileSystem.getInfoAsync(image.localPath);
                if (!fileInfo.exists) continue;

                const base64Data = await FileSystem.readAsStringAsync(image.localPath, {
                    encoding: FileSystem.EncodingType.Base64
                });

                // 2. Encrypt to Base64 (not hex!)
                const { encryptedData: encryptedBase64String, nonce } = encryptImagePayload(base64Data, masterKey);

                // 3. Convert Base64 to ArrayBuffer to drop the 33% bloat
                const binaryArrayBuffer = decode(encryptedBase64String);

                // 4. Upload to Storage as raw binary
                const storagePath = `${userId}/${image.id}`;
                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(storagePath, binaryArrayBuffer, {
                        contentType: 'application/octet-stream',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // 4. Insert Metadata into DB
                const { error: metaError } = await supabase
                    .from('encrypted_images')
                    .upsert({
                        id: image.id,
                        user_id: userId,
                        nonce: nonce,
                        created_at: new Date().toISOString()
                    });

                if (metaError) throw metaError;

                // 5. Insert Link
                const { error: linkError } = await supabase
                    .from('note_images')
                    .upsert({
                        note_id: noteId,
                        image_id: image.id,
                        user_id: userId
                    });

                if (linkError) throw linkError;

                pushedImageIds.push(image.id);

            } catch (err) {
                console.error(`[ImageSync] Failed to push image ${image.id}`, err);
            }
        }

        // 6. Update local DB
        if (pushedImageIds.length > 0) {
            ImagesRepo.markImagesAsSynced(pushedImageIds);
            console.log(`[ImageSync] Successfully pushed ${pushedImageIds.length} images.`);
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

            // Generate a temporary file path
            const cacheDir = FileSystem.cacheDirectory || `${FileSystem.documentDirectory}cache/`;
            const tempUri = `${cacheDir}${item.imageId}.enc`;

            // Download encrypted blob directly to file system to save memory
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .download(storagePath);

            if (error || !data) throw error || new Error("No data returned");

            // Convert blob to ArrayBuffer
            const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = reject;
                reader.readAsArrayBuffer(data);
            });
            const uint8Array = new Uint8Array(arrayBuffer);

            // Decrypt
            const base64Decrypted = decryptImagePayload(uint8Array, item.nonce, item.masterKey);

            // Recreate image locally
            const fileName = `${Crypto.randomUUID()}.jpg`; // Assuming jpg for now or deduce from base64 header
            const docDir = FileSystem.documentDirectory || '';
            const newLocalPath = `${docDir}images/${fileName}`;

            // Ensure dir exists
            const dirInfo = await FileSystem.getInfoAsync(`${docDir}images/`);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(`${docDir}images/`, { intermediates: true });
            }

            await FileSystem.writeAsStringAsync(newLocalPath, base64Decrypted, {
                encoding: FileSystem.EncodingType.Base64
            });

            // Need image info
            const fileInfo = await FileSystem.getInfoAsync(newLocalPath);
            if (!fileInfo.exists) throw new Error("File creation failed");

            // Construct minimal image record
            const newImage: Parameters<typeof ImagesRepo.insertImage>[0] = {
                id: item.imageId,
                localPath: newLocalPath,
                size: fileInfo.size,
                syncStatus: 'synced',
                createdAt: new Date(),
                // Height, width and hash can't easily be derived here without loading into UI. 
                // We'll leave them null or default.
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
