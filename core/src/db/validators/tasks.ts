import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { tasks } from '../schema';

export const insertTaskSchema = createInsertSchema(tasks, {
    title: (schema) => schema.min(1, 'Title is required').max(50, 'Title must be 50 characters or less'),
    description: (schema) => schema.max(200, 'Description must be 200 characters or less'),
    deadline: z.date(),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    isDirty: true,
    isPermDeleted: true
});
