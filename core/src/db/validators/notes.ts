import { MAX_TITLE_LENGTH } from '../../utils/notes';

export interface NoteMetadataInsertInput {
    title?: string;
    folderId?: string | null;
    originalFolderId?: string | null;
    [key: string]: any;
}

export const insertNoteMetadataSchema = {
    parse: (data: NoteMetadataInsertInput) => {
        if (data.title !== undefined) {
            const len = data.title.trim().length;
            if (len < 1) {
                throw new Error("Title must be at least 1 character");
            }
            if (len > MAX_TITLE_LENGTH) {
                throw new Error(`Title must be ${MAX_TITLE_LENGTH} characters or less`);
            }
        }
        return data;
    },
    partial: () => ({
        parse: (data: Partial<NoteMetadataInsertInput>) => {
            if (data.title !== undefined) {
                const len = data.title.trim().length;
                if (len < 1) {
                    throw new Error("Title must be at least 1 character");
                }
                if (len > MAX_TITLE_LENGTH) {
                    throw new Error(`Title must be ${MAX_TITLE_LENGTH} characters or less`);
                }
            }
            return data;
        }
    })
};

