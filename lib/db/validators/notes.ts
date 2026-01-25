import { noteMetadata } from '@/lib/db/schema';
import { MAX_TITLE_LENGTH } from '@/lib/utils/notes';
import { createInsertSchema } from 'drizzle-zod';

export const insertNoteMetadataSchema = createInsertSchema(noteMetadata, {
    title: (schema) => schema.min(1).max(MAX_TITLE_LENGTH),
});
