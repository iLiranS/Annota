import { tasks } from '@/lib/db/schema';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const insertTaskSchema = createInsertSchema(tasks, {
    title: (schema) => schema.min(1, 'Title is required').max(50, 'Title must be 50 characters or less'),
    description: (schema) => schema.max(200, 'Description must be 200 characters or less'),
    deadline: z.date(),
}).pick({
    title: true,
    description: true,
    deadline: true,
    isWholeDay: true,
    completed: true,
    folderId: true,
    links: true,
});
