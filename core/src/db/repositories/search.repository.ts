import { and, desc, eq, inArray, like, sql } from 'drizzle-orm';
import { getDb, useDbStore } from '../../stores/db.store';
import * as schema from '../schema';
import { safeGetAll } from '../utils';

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

// Typed row returned from the FTS-only pass
type FtsRow = {
    id: string;
    matchedSnippet: string;
    score: number;
};

// Typed row returned from the metadata pass
type MetaRow = {
    id: string | null;
    title: string | null;
    preview: string | null;
    folderId: string | null;
    updatedAt: Date | null;
};

// Final merged result
export type NoteSearchRow = {
    id: string;
    title: string | null;
    preview: string | null;
    folderId: string | null;
    updatedAt: Date | null;
    matchedSnippet: string | null;
    score: number;
};

export const SearchRepository = {
    // Helper to safely build an FTS5 query. Optionally strips stop words.
    _buildFtsQuery(query: string, operator: 'AND' | 'OR', removeStopWords = false): string {
        // Extract words, filtering out empty ones and ones that are exclusively punctuation/symbols
        // (FTS5 unicode61 tokenizer drops punctuation, so a purely punctuation word becomes an empty token phrase which breaks matches)
        let words = query.trim().toLowerCase().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));

        if (removeStopWords) {
            words = words.filter(w => !STOP_WORDS.has(w) && w.length > 1);
        }

        if (words.length === 0) return '""';
        return words.map(w => `"${w.replace(/"/g, '""')}"*`).join(` ${operator} `);
    },

    async searchNotes(query: string, folderId: string | null = null, limit: number | null = 50): Promise<NoteSearchRow[]> {
        const db = getDb();

        const executeSearch = async (ftsQuery: string, limit?: number): Promise<NoteSearchRow[]> => {
            const dbStore = useDbStore.getState();
            const isDesktop = (dbStore.nativeDb as any)?.selectAsync !== undefined;

            if (isDesktop) {
                // Desktop: Bypass Drizzle, query native db wrapper directly
                const limitClause = limit ? `LIMIT ${limit}` : '';
                // FIX: Use folder_id
                const folderClause = folderId ? `AND m.folder_id = '${folderId}'` : '';

                const rawRows = await (dbStore.nativeDb as any).selectAsync(
                    `SELECT 
                m.id, 
                m.title, 
                m.preview, 
                m.folder_id, 
                m.updated_at,
                snippet(f.notes_fts, 3, '', '', '...', 20) AS matchedSnippet,
                f.rank AS score
            FROM notes_fts f
            JOIN note_metadata m ON f.id = m.id
            WHERE f.notes_fts MATCH ? 
              AND m.is_deleted = 0  -- FIX: Use is_deleted
              AND m.is_perm_deleted = 0 -- FIX: Use is_perm_deleted
              ${folderClause}
            ORDER BY f.rank
            ${limitClause}`,
                    [ftsQuery]
                ) as any[][];

                return rawRows.map(row => ({
                    id: row[0] as string,
                    title: row[1] as string | null,
                    preview: row[2] as string | null,
                    folderId: row[3] as string | null,
                    updatedAt: row[4] ? new Date(row[4]) : null, // Ensured Date object parsing
                    matchedSnippet: row[5] as string,
                    score: -(row[6] as number), // Invert rank
                }));

            } else {
                // Mobile: expo-sqlite natively handles raw named columns
                // We use AS to map the snake_case DB columns back to camelCase TS properties
                const rows = await db.all(sql`
            SELECT 
                m.id, 
                m.title, 
                m.preview, 
                m.folder_id AS folderId, 
                m.updated_at AS updatedAt,
                snippet(f.notes_fts, 3, '', '', '...', 20) AS matchedSnippet,
                -bm25(f.notes_fts) AS score
            FROM notes_fts f
            JOIN note_metadata m ON f.id = m.id
            WHERE f.notes_fts MATCH ${ftsQuery}
              AND m.is_deleted = 0 
              AND m.is_perm_deleted = 0
              ${folderId ? sql`AND m.folder_id = ${folderId}` : sql``}
            ORDER BY score DESC
            ${limit ? sql`LIMIT ${limit}` : sql``}
        `);

                return rows as NoteSearchRow[];
            }
        };

        // PASS 1: Strict Mode — require ALL words to match (AND)
        const ftsQueryAnd = this._buildFtsQuery(query, 'AND', false);
        let results = await executeSearch(ftsQueryAnd, limit ?? undefined);

        // PASS 2: Waterfall Fallback — OR search with stop words stripped
        if (results.length === 0) {
            const ftsQueryOr = this._buildFtsQuery(query, 'OR', true);
            if (ftsQueryOr !== '""' && ftsQueryOr !== ftsQueryAnd) {
                results = await executeSearch(ftsQueryOr, limit ?? 50);
            }
        }

        return results;
    },

    /**
     * Lightweight FTS query for AI context retrieval.
     */
    async findRelevantNoteIds(query: string, folderNoteIds?: string[], limit = 3): Promise<string[]> {
        if (!folderNoteIds || folderNoteIds.length === 0) return [];
        const uniqueNoteIds = Array.from(new Set(folderNoteIds));

        const ftsQuery = this._buildFtsQuery(query, 'OR', true);

        if (ftsQuery === '""') return [];

        const dbStore = useDbStore.getState();
        const isDesktop = (dbStore.nativeDb as any)?.selectAsync !== undefined;
        let ids: string[] = [];

        if (isDesktop) {
            // Desktop bypass for raw FTS group query
            const placeholders = uniqueNoteIds.map(() => '?').join(',');
            const rawRows = await (dbStore.nativeDb as any).selectAsync(
                `SELECT id
                FROM notes_fts
                WHERE notes_fts MATCH ? AND id IN (${placeholders})
                GROUP BY id
                ORDER BY rank
                LIMIT ${limit * 2}`,
                [ftsQuery, ...uniqueNoteIds]
            ) as any[][];

            ids = rawRows.map(row => row[0] as string).filter(Boolean);
        } else {
            // Mobile standard Drizzle
            const ftsRows = await getDb().all<{ id: string }>(sql`
                SELECT id
                FROM notes_fts
                WHERE notes_fts MATCH ${ftsQuery} AND ${inArray(schema.notesFts.id, uniqueNoteIds)}
                GROUP BY id
                ORDER BY rank
                LIMIT ${limit * 2}
            `);
            ids = ftsRows.map((r: any) => r.id).filter(Boolean);
        }

        // Validate against note_metadata (isDeleted check) — only if we have candidates
        if (ids.length === 0) return [];

        const validRows = await getDb().select({ id: schema.noteMetadata.id })
            .from(schema.noteMetadata)
            .where(and(
                inArray(schema.noteMetadata.id, ids),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false),
            ))
            .all();

        const validIds = new Set(validRows.map((r: any) => r.id).filter(Boolean) as string[]);

        // Preserve FTS rank order
        return ids.filter((id: string) => validIds.has(id)).slice(0, limit);
    },


    async searchFolders(query: string) {
        const exactMatch = query;
        const startsWithMatch = `${query}%`;
        const conditions = [
            eq(schema.folders.isDeleted, false),
            eq(schema.folders.isSystem, false),
            like(schema.folders.name, `%${query}%`)
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
                    ELSE 3
                END
            `.as('score')
        })
            .from(schema.folders)
            .where(and(...conditions))
            .orderBy(desc(sql`score`), desc(schema.folders.updatedAt))
            .all();
    },

    /**
     * Finds all notes that contain at least one uncompleted task item
     * using the structured note_tasks table.
     * Returns parsed task groups per note.
     */
    async findNotesWithPendingTasks(): Promise<PendingTaskNote[]> {
        const db = getDb();

        const rows = await db
            .select({
                noteId: schema.noteTasks.noteId,
                noteTitle: schema.noteMetadata.title,
                folderId: schema.noteMetadata.folderId,
                createdAt: schema.noteMetadata.createdAt,
                taskIndex: schema.noteTasks.taskIndex,
                taskText: schema.noteTasks.text,
            })
            .from(schema.noteTasks)
            .innerJoin(schema.noteMetadata, eq(schema.noteTasks.noteId, schema.noteMetadata.id))
            .where(and(
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false),
            ))
            .all();

        const safeRows = safeGetAll<{
            noteId: string;
            noteTitle: string | null;
            folderId: string | null;
            createdAt: Date | null;
            taskIndex: number;
            taskText: string;
        }>(rows);

        const groupMap = new Map<string, PendingTaskNote>();

        for (const row of safeRows) {
            let group = groupMap.get(row.noteId);
            if (!group) {
                group = {
                    noteId: row.noteId,
                    noteTitle: row.noteTitle || 'Untitled Note',
                    folderId: row.folderId,
                    createdAt: row.createdAt ? new Date(row.createdAt) : null,
                    tasks: [],
                };
                groupMap.set(row.noteId, group);
            }
            group.tasks.push({
                index: row.taskIndex,
                text: row.taskText,
            });
        }

        const results = Array.from(groupMap.values());

        // Sort tasks within each note by taskIndex to ensure stable positional order
        for (const group of results) {
            group.tasks.sort((a, b) => a.index - b.index);
        }

        // Sort by note creation date — newest first, stable regardless of edits
        results.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        return results;
    },
};

// ============ TYPES ============

export type PendingTask = {
    /** Stable positional index within the note's unchecked tasks (for toggling) */
    index: number;
    text: string;
};

export type PendingTaskNote = {
    noteId: string;
    noteTitle: string;
    folderId: string | null;
    createdAt: Date | null;
    tasks: PendingTask[];
};

// ============ HELPERS ============

/**
 * Parses unchecked task items from raw HTML content.
 * Extracts the text of each <li data-checked="false"> element.
 */
export function parsePendingTasks(html: string): PendingTask[] {
    const tasks: PendingTask[] = [];
    // Match <li data-checked="false">…</li> — greedy-safe with non-greedy inner
    const liRegex = /<li[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = liRegex.exec(html)) !== null) {
        const innerHtml = match[1] ?? '';
        // Strip all HTML tags to get plain text
        const text = innerHtml
            .replace(/<[^>]+>/g, '')
            .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length > 0) {
            tasks.push({ index, text });
            index++;
        }
    }
    return tasks;
}