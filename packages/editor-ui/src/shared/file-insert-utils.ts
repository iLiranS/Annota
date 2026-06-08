import { NoteFileService } from '@annota/core/platform';

export interface FileInsertionCallbacks {
    insertImage: (args: { imageId: string; src: string }) => void;
    insertAttachment?: (args: { fileId: string; fileName: string; fileSize: number; localPath: string; mimeType: string }) => void;
}

export async function insertProcessedFile(
    noteId: string,
    fileUri: string,
    { insertImage, insertAttachment }: FileInsertionCallbacks
) {
    const processed = await NoteFileService.processAndInsertFile(noteId, fileUri);
    const fileMap = await NoteFileService.resolveFileSources([processed.fileId]);
    if (processed.mimeType === 'application/pdf' && insertAttachment) {
        insertAttachment({
            fileId: processed.fileId,
            fileName: processed.fileName,
            fileSize: processed.fileSize,
            localPath: processed.localPath,
            mimeType: processed.mimeType
        });
    } else {
        insertImage({
            imageId: processed.fileId,
            src: fileMap[processed.fileId]
        });
    }
}

export async function insertRemoteFile(
    noteId: string,
    url: string,
    { insertImage, insertAttachment }: FileInsertionCallbacks
) {
    const processed = await NoteFileService.processRemoteFile(noteId, url);
    const fileMap = await NoteFileService.resolveFileSources([processed.fileId]);
    if (processed.mimeType === 'application/pdf' && insertAttachment) {
        insertAttachment({
            fileId: processed.fileId,
            fileName: processed.fileName,
            fileSize: processed.fileSize,
            localPath: processed.localPath,
            mimeType: processed.mimeType
        });
    } else {
        insertImage({
            imageId: processed.fileId,
            src: fileMap[processed.fileId]
        });
    }
}
