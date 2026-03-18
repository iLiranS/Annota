import { NoteImageService } from '@annota/core/platform';

export type PastedImagePayload = {
    base64?: string;
    imageId?: string;
    pos?: number;
    src?: string;
};

type InsertImageFn = (params: { imageId: string; pos?: number; src?: string }) => void;
type ResolveImagesFn = (imageMap: Record<string, string>) => void;
type ReplaceImageIdFn = (params: { oldId: string; newId: string; src?: string }) => void;

export async function handleImagePaste(params: {
    noteId?: string;
    data: PastedImagePayload;
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
            const imageMap = await NoteImageService.resolveImageSources([normalizedId]);
            if (Object.keys(imageMap).length > 0) {
                resolveImages(imageMap);
            }
        }
        return;
    }

    // External paste: process through service first.
    if (!data.base64 || !noteId) return;

    const tempId = normalizedId && normalizedId.startsWith('temp-') ? normalizedId : null;
    const { id, url } = await NoteImageService.saveNoteImage(noteId, data.base64);

    if (tempId && replaceImageId) {
        replaceImageId({ oldId: tempId, newId: id, src: url });
    } else {
        insertImage({ imageId: id, pos: data.pos, src: url });
    }

    if (resolveImages) {
        if (url) {
            resolveImages({ [id]: url });
        } else {
            const imageMap = await NoteImageService.resolveImageSources([id]);
            if (Object.keys(imageMap).length > 0) {
                resolveImages(imageMap);
            }
        }
    }
}
