import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import * as schema from '../schema';

// A robust list of common English stop words + domain-specific noise words
const STOP_WORDS = new Set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
    'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
    'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
    // Domain specific conversational noise
    'note', 'notes', 'document', 'documents', 'tell', 'show', 'find', 'search', 'related', 'stuff'
]);

export const SearchRepository = {
    // Helper to safely build an FTS5 query. Optionally strips stop words.
    _buildFtsQuery(query: string, operator: 'AND' | 'OR', removeStopWords = false) {
        let words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

        if (removeStopWords) {
            // Keep words that are NOT stop words, and are longer than 1 character
            words = words.filter(w => !STOP_WORDS.has(w) && w.length > 1);
        }

        if (words.length === 0) return '""';
        return words.map(w => `"${w.replace(/"/g, '""')}"*`).join(` ${operator} `);
    },

    async searchNotes(query: string, folderId: string | null = null) {
        const db = getDb();
        const conditions = [
            eq(schema.noteMetadata.isDeleted, false),
            eq(schema.noteMetadata.isPermDeleted, false)
        ];

        if (folderId) {
            conditions.push(eq(schema.noteMetadata.folderId, folderId));
        }

        // Helper to run the query so we can reuse it for the fallback
        const executeSearch = async (ftsQuery: string, limit?: number) => {
            let baseQuery = db.select({
                id: schema.noteMetadata.id,
                title: schema.noteMetadata.title,
                preview: schema.noteMetadata.preview,
                folderId: schema.noteMetadata.folderId,
                updatedAt: schema.noteMetadata.updatedAt,
                matchedSnippet: sql<string>`snippet(notes_fts, 3, '', '', '...', 20)`.as('matchedSnippet'),
                score: sql<number>`-bm25(notes_fts)`.as('score')
            })
                .from(schema.notesFts)
                .innerJoin(schema.noteMetadata, eq(schema.notesFts.id, schema.noteMetadata.id))
                .where(and(
                    sql`notes_fts MATCH ${ftsQuery}`,
                    ...conditions
                ))
                .orderBy(desc(sql`score`), desc(schema.noteMetadata.updatedAt));

            if (limit) {
                baseQuery = baseQuery.limit(limit) as any;
            }

            return await baseQuery.all();
        };

        // PASS 1: Strict Mode. Require ALL words to match exactly (AND).
        let ftsQuery = this._buildFtsQuery(query, 'AND', false);
        let results = await executeSearch(ftsQuery);

        // PASS 2: Waterfall Fallback ("Good Enough" mode for typos)
        // If "apple signatuers" fails, we fall back to an OR search, but we STRIP stop words 
        // so typing "the signatuers" doesn't suddenly return every note with the word "the".
        if (results.length === 0) {
            ftsQuery = this._buildFtsQuery(query, 'OR', true);
            if (ftsQuery !== '""') {
                results = await executeSearch(ftsQuery, 10); // Limit fallback results to top 10
            }
        }

        return results;
    },

    /**
     * Lightweight FTS query for AI context retrieval.
     */
    async findRelevantNoteIds(query: string, folderNoteIds?: string[], limit = 3): Promise<string[]> {
        // AI Retrieval: Strip stop words completely!
        // "what note is about encryption related stuff" becomes just ["encryption"]
        const ftsQuery = this._buildFtsQuery(query, 'OR', true);

        // If the query was purely conversational (e.g., "what is this"), fallback to returning nothing,
        // allowing the UI to grab the most recently updated notes instead.
        if (ftsQuery === '""') return [];

        const conditions: any[] = [
            sql`notes_fts MATCH ${ftsQuery}`,
            eq(schema.noteMetadata.isDeleted, false),
            eq(schema.noteMetadata.isPermDeleted, false)
        ];

        if (folderNoteIds && folderNoteIds.length > 0) {
            conditions.push(inArray(schema.notesFts.id, folderNoteIds));
        }

        const results = await getDb().select({ id: schema.notesFts.id })
            .from(schema.notesFts)
            .innerJoin(schema.noteMetadata, eq(schema.notesFts.id, schema.noteMetadata.id))
            .where(and(...conditions))
            .orderBy(sql`rank`)
            .limit(limit)
            .all();

        return results.map((r: { id: string | null }) => r.id!).filter(Boolean);
    },

    async searchFolders(query: string) {
        const exactMatch = query;
        const startsWithMatch = `${query}%`;
        const searchTerm = `%${query}%`;
        const conditions = [
            eq(schema.folders.isDeleted, false),
            eq(schema.folders.isSystem, false)
        ];

        return getDb().select({
            id: schema.folders.id,
            name: schema.folders.name,
            color: schema.folders.color,
            icon: schema.folders.icon,
            updatedAt: schema.folders.updatedAt,
            score: sql<number>`
                CASE 
                    WHEN LOWER(${schema.folders.name}) = LOWER(${exactMatch}) THEN 5
                    WHEN LOWER(${schema.folders.name}) LIKE LOWER(${startsWithMatch}) THEN 4
                    WHEN LOWER(${schema.folders.name}) LIKE LOWER(${searchTerm}) THEN 3
                    ELSE 0 
                END
            `.as('score')
        })
            .from(schema.folders)
            .where(and(...conditions, sql`score > 0`))
            .orderBy(desc(sql`score`), desc(schema.folders.updatedAt))
            .all();
    }
};
