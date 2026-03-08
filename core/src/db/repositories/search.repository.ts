import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import * as schema from '../schema';

export const SearchRepository = {
    async searchNotes(query: string, folderId: string | null = null) {
        const searchTerm = `%${query}%`;

        // Base conditions: not deleted and not permanently deleted
        const conditions = [
            eq(schema.noteMetadata.isDeleted, false),
            eq(schema.noteMetadata.isPermDeleted, false)
        ];

        if (folderId) {
            conditions.push(eq(schema.noteMetadata.folderId, folderId));
        }

        // Prioritization logic: Title (3) > Preview (2) > Content (1)
        // Optimization: We join with noteContent to search the body, but we don't select the body itself.
        return getDb().select({
            id: schema.noteMetadata.id,
            title: schema.noteMetadata.title,
            preview: schema.noteMetadata.preview,
            folderId: schema.noteMetadata.folderId,
            updatedAt: schema.noteMetadata.updatedAt,
            score: sql<number>`
                CASE 
                    WHEN LOWER(${schema.noteMetadata.title}) LIKE LOWER(${searchTerm}) THEN 3
                    WHEN LOWER(${schema.noteMetadata.preview}) LIKE LOWER(${searchTerm}) THEN 2
                    WHEN LOWER(${schema.noteContent.content}) LIKE LOWER(${searchTerm}) THEN 1
                    ELSE 0 
                END
            `.as('score')
        })
            .from(schema.noteMetadata)
            .leftJoin(schema.noteContent, eq(schema.noteMetadata.id, schema.noteContent.id))
            .where(and(...conditions, sql`score > 0`))
            .orderBy(desc(sql`score`), desc(schema.noteMetadata.updatedAt))
            .all();
    },

    async searchTasks(query: string, folderId: string | null = null) {
        const searchTerm = `%${query}%`;

        const conditions = [
            eq(schema.tasks.isPermDeleted, false)
        ];

        if (folderId) {
            conditions.push(eq(schema.tasks.folderId, folderId));
        }

        return getDb().select({
            id: schema.tasks.id,
            title: schema.tasks.title,
            description: schema.tasks.description,
            deadline: schema.tasks.deadline,
            folderId: schema.tasks.folderId,
            completed: schema.tasks.completed,
            updatedAt: schema.tasks.updatedAt,
            // Prioritization logic: Title (3) > Description (2) > Links/Other (1)
            score: sql<number>`
                CASE 
                    WHEN LOWER(${schema.tasks.title}) LIKE LOWER(${searchTerm}) THEN 3
                    WHEN LOWER(${schema.tasks.description}) LIKE LOWER(${searchTerm}) THEN 2
                    WHEN LOWER(${schema.tasks.links}) LIKE LOWER(${searchTerm}) THEN 1
                    ELSE 0 
                END
            `.as('score')
        })
            .from(schema.tasks)
            .where(and(...conditions, sql`score > 0`))
            .orderBy(desc(sql`score`), desc(schema.tasks.updatedAt))
            .all();
    }
};
