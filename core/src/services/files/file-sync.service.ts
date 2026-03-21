import { encode } from 'base64-arraybuffer';
import { Buffer } from 'buffer';
import { getPlatformAdapters } from '../../adapters';
import { storageApi } from '../../api/storage.api';
import * as FilesRepo from '../../db/repositories/files.repository';
import type { FileInsert } from '../../db/schema';
import { useSyncStore } from '../../stores/sync.store';
import { decryptImageBytes, deriveAesKey, encryptImageBytes } from '../../utils/crypto';
import { getFilesDirectory, resolveLocalUri } from './file.service';

const BUCKET_NAME = 'e2e_attachments';
const MAX_CONCURRENT_DOWNLOADS = 3;

export interface QueueItem {
    fileId: string;
    noteId: string;
    nonce: string;
    masterKey: string;
    userId: string;
}

/** Check if the first bytes match known file format magic bytes */
function detectFileFormat(bytes: Uint8Array): 'webp' | 'pdf' | 'jpg' | 'png' | null {
    if (bytes.length < 4) return null;
    // PDF: starts with "%PDF"
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
    // WEBP: starts with "RIFF"
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'webp';
    // JPEG: starts with 0xFF 0xD8
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpg';
    // PNG: starts with 0x89 0x50 0x4E 0x47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    return null;
}

class FileSyncService {
    private isDownloading: boolean = false;
    private downloadQueue: QueueItem[] = [];
    private activeDownloads: number = 0;

    /**
     * Push pending files linked to HEAD versions of notes up to Supabase.
     */
    async pushFiles(masterKey: string, userId: string, noteIdsToRefresh: string[] = []): Promise<void> {
        // 1. Get/Derive the AES key
        const { aesKey, activeMnemonic, setAesKey } = useSyncStore.getState();
        const currentKey = (aesKey && activeMnemonic === masterKey)
            ? aesKey
            : Buffer.from(deriveAesKey(masterKey));

        // 2. Update the store if we derived a new one
        if (activeMnemonic !== masterKey) {
            setAesKey(masterKey, currentKey);
        }

        const candidates = await FilesRepo.getPendingFilesLinkedToLatestVersions();

        const notesWithPendingFiles = new Set(candidates.map(c => c.noteId));
        const uniquePendingFiles = new Map(candidates.map(c => [c.file.id, c.file]));

        if (uniquePendingFiles.size > 0) {
            console.log(`[FileSync] Found ${uniquePendingFiles.size} unique pending files for push.`);

            const pushedFileIds: string[] = [];
            const pendingFilesList = Array.from(uniquePendingFiles.values());

            for (const file of pendingFilesList) {
                try {
                    // 1. Read file from disk as raw bytes
                    let rawBytes: Uint8Array;
                    try {
                        const absoluteUri = await resolveLocalUri(file.localPath);
                        rawBytes = await getPlatformAdapters().fileSystem.readBytes(absoluteUri);
                    } catch (e) {
                        console.warn(`[FileSync] Could not read file for file ${file.id} at ${file.localPath}. Skipping.`, e);
                        continue; // file doesn't exist or unreadable
                    }

                    // 2. Encrypt raw bytes directly
                    const { encryptedBytes, nonce } = await encryptImageBytes(rawBytes, currentKey);

                    // 3. Upload encrypted bytes to Storage
                    const storagePath = `${userId}/${file.id}`;
                    const uploadBuffer = encryptedBytes.buffer.slice(
                        encryptedBytes.byteOffset,
                        encryptedBytes.byteOffset + encryptedBytes.byteLength,
                    ) as ArrayBuffer;

                    const base64Data = encode(uploadBuffer);

                    const { error: uploadError } = await storageApi.uploadFile(storagePath, base64Data, 'application/octet-stream', BUCKET_NAME);

                    if (uploadError) throw uploadError;

                    // 4. Insert Metadata into DB
                    if (!file.mimeType || !file.sizeBytes) {
                        throw new Error(`[FileSync] File ${file.id} is missing mimeType or sizeBytes. Cannot upload.`);
                    }
                    const { error: metaError } = await storageApi.upsertEncryptedFile(file.id, userId, nonce, file.mimeType, file.sizeBytes);

                    if (metaError) throw metaError;

                    pushedFileIds.push(file.id);
                } catch (err) {
                    console.error(`[FileSync] Failed to push file ${file.id}`, err);
                }
            }

            // 5. Update local DB
            if (pushedFileIds.length > 0) {
                await FilesRepo.markFilesAsSynced(pushedFileIds);
                console.log(`[FileSync] Successfully pushed ${pushedFileIds.length} files.`);
            }
        }

        const noteIdsNeedingReplace = Array.from(new Set([
            ...noteIdsToRefresh,
            ...Array.from(notesWithPendingFiles),
        ]));

        if (noteIdsNeedingReplace.length === 0) {
            return;
        }

        const latestFileStateByNote = await FilesRepo.getLatestVersionFileIdsForNotes(noteIdsNeedingReplace);
        for (const { noteId, fileIds } of latestFileStateByNote) {
            try {
                // Only reference files that have been successfully pushed (exist in encrypted_files)
                const syncedFileIds = fileIds.length > 0
                    ? (await FilesRepo.getFilesByIds(fileIds))
                        .filter(f => f.syncStatus === 'synced')
                        .map(f => f.id)
                    : [];

                const { error } = await storageApi.replaceE2ENoteFiles(noteId, userId, syncedFileIds);

                if (error) {
                    // Catch Postgres Foreign Key Violation for missing files - auto heal
                    if (error.code === '23503' && error.message?.includes('note_files_file_id_fkey')) {
                        console.warn(`[FileSync] Remote DB missing files for note ${noteId}. Reverting local status to pending to force re-upload.`);

                        if (syncedFileIds.length > 0) {
                            await FilesRepo.revertFilesToPending(syncedFileIds);
                        }
                    }
                    throw error;
                }
            } catch (err) {
                console.error(`[FileSync] Failed to replace note_files for note ${noteId}`, err);
            }
        }
    }

    async retryPendingDownloads(masterKey: string, userId: string) {
        const pendingItems = await FilesRepo.getPendingDownloads();
        if (pendingItems.length > 0) {
            console.log(`[FileSync] Retrying ${pendingItems.length} pending downloads...`);
            const itemsToQueue: QueueItem[] = pendingItems.map(p => ({
                ...p,
                masterKey,
                userId
            }));
            this.queueFilesForDownload(itemsToQueue);
        }
    }

    /**
     * Add files to download queue and start processing
     */
    async queueFilesForDownload(items: QueueItem[]) {
        if (items.length === 0) return;

        // 1. Persist intention to local DB FIRST (Safety Net)
        const dbQueueItems = items.map(({ fileId, noteId, nonce, userId }) => ({
            fileId, noteId, nonce, userId
        }));
        await FilesRepo.upsertDownloadQueue(dbQueueItems);

        // 2. Prevent adding duplicates to the active in-memory queue
        const existingIds = new Set(this.downloadQueue.map(q => q.fileId));
        const newItems = items.filter(item => !existingIds.has(item.fileId));

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

            const batch = this.downloadQueue.slice(0, slotsAvailable);
            this.activeDownloads += batch.length;

            // Process batch concurrently
            await Promise.all(batch.map(async (item) => {
                const success = await this.downloadSingleFile(item);

                this.downloadQueue = this.downloadQueue.filter(q => q.fileId !== item.fileId);

                if (success) {
                    await FilesRepo.removeFromDownloadQueue(item.fileId);
                }
            }));

            this.activeDownloads -= batch.length;
        }

        this.isDownloading = false;
    }

    private async downloadSingleFile(item: QueueItem): Promise<boolean> {
        try {
            const storagePath = `${item.userId}/${item.fileId}`;

            // Download encrypted blob from Supabase
            const { data, error } = await storageApi.downloadFile(storagePath, BUCKET_NAME);

            if (error || !data) throw error || new Error('No data returned');

            // Convert blob → ArrayBuffer via FileReader
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

            // Ensure files directory exists
            const filesDir = await getFilesDirectory();

            // Detect format
            const format = detectFileFormat(decryptedBytes);
            const isRawBinary = format !== null;

            let fileExt: string;
            let fileBytes: Uint8Array;

            if (isRawBinary) {
                fileExt = format;
                fileBytes = decryptedBytes;
            } else {
                // Legacy format: decrypted bytes are a base64-encoded string
                const base64String = new TextDecoder().decode(decryptedBytes);
                const rawBytes = Buffer.from(base64String, 'base64');
                fileExt = 'jpg';
                fileBytes = new Uint8Array(rawBytes);
            }

            // Write to disk
            const separator = filesDir.endsWith('/') ? '' : '/';
            const newLocalPath = `${filesDir}${separator}${item.fileId}.${fileExt}`;
            await getPlatformAdapters().fileSystem.writeBytes(newLocalPath, fileBytes);
            const fileSize = await getPlatformAdapters().fileSystem.getSize(newLocalPath);

            // Construct minimal file record
            const newFile: FileInsert = {
                id: item.fileId,
                localPath: `${item.fileId}.${fileExt}`,
                fileType: fileExt === 'pdf' ? 'pdf' : 'image',
                sizeBytes: fileSize,
                syncStatus: 'synced',
                createdAt: new Date(),
            };

            // Save to DB
            const existing = await FilesRepo.getFileById(newFile.id);
            const existingRecord = Array.isArray(existing) ? existing[0] : existing;

            if (!existingRecord || !existingRecord.id) {
                await FilesRepo.insertFile(newFile);
            } else if (existingRecord.syncStatus !== 'synced') {
                await FilesRepo.markFilesAsSynced([newFile.id]);
            }

            console.log(`[FileSync] Downloaded and synced file ${item.fileId} (${isRawBinary ? format : 'legacy'})`);
            return true;
        } catch (error) {
            console.error(`[FileSync] Error downloading file ${item.fileId}`, error);
            return false;
        }
    }
}

export const fileSyncService = new FileSyncService();
