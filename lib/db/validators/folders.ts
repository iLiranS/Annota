import { folders } from '@/lib/db/schema';
import { createInsertSchema } from 'drizzle-zod';

export const insertFolderSchema = createInsertSchema(folders, {
    name: (schema) => schema.min(1).max(50, 'Folder name must be 50 characters or less'),
});
