import { NoteFileService } from '@annota/core/platform';

export type PastedFilePayload = {
    base64?: string;
    imageId?: string; // Tiptap still uses imageId as attribute name for now
    pos?: number;
    src?: string;
};

type InsertImageFn = (params: { imageId: string; pos?: number; src?: string }) => void;
type ResolveImagesFn = (imageMap: Record<string, string>) => void;
type ReplaceImageIdFn = (params: { oldId: string; newId: string; src?: string }) => void;

export async function handleFilePaste(params: {
    noteId?: string;
    data: PastedFilePayload;
    insertImage: InsertImageFn;
    resolveImages?: ResolveImagesFn;
    replaceImageId?: ReplaceImageIdFn;
}): Promise<void> {
    const { noteId, data, insertImage, resolveImages, replaceImageId } = params;

    const normalizedId = data.imageId?.trim();

    // Internal paste: reuse existing imageId (no re-processing).
    if (normalizedId && !normalizedId.startsWith('temp-')) {
        insertImage({ imageId: normalizedId, pos: data.pos, src: data.src });
        if (resolveImages) {
            const fileMap = await NoteFileService.resolveFileSources([normalizedId]);
            if (Object.keys(fileMap).length > 0) {
                resolveImages(fileMap);
            }
        }
        return;
    }

    // External paste: process through service first.
    if (!data.base64 || !noteId) return;

    const tempId = normalizedId && normalizedId.startsWith('temp-') ? normalizedId : null;
    const { id, url } = await NoteFileService.saveNoteFile(noteId, data.base64);

    if (tempId && replaceImageId) {
        replaceImageId({ oldId: tempId, newId: id, src: url });
    } else {
        insertImage({ imageId: id, pos: data.pos, src: url });
    }

    if (resolveImages) {
        if (url) {
            resolveImages({ [id]: url });
        } else {
            const fileMap = await NoteFileService.resolveFileSources([id]);
            if (Object.keys(fileMap).length > 0) {
                resolveImages(fileMap);
            }
        }
    }
}
