import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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

    async searchNotes(query: string, folderId: string | null = null): Promise<NoteSearchRow[]> {
        const db = getDb();

        const executeSearch = async (ftsQuery: string, limit?: number): Promise<NoteSearchRow[]> => {
            const dbStore = useDbStore.getState();
            const isDesktop = (dbStore.nativeDb as any)?.selectAsync !== undefined;
            let ftsRows: FtsRow[];

            if (isDesktop) {
                // Desktop: Bypass Drizzle proxy, query native db wrapper directly
                // Rust returns positional arrays: [id, matchedSnippet, score]
                const rawRows = await (dbStore.nativeDb as any).selectAsync(
                    `SELECT
                        id,
                        snippet(notes_fts, 3, '', '', '...', 20) AS matchedSnippet,
                        rank AS score
                    FROM notes_fts
                    WHERE notes_fts MATCH ?
                    ORDER BY rank
                    ${limit ? `LIMIT ${limit * 2}` : ''}`,
                    [ftsQuery]
                ) as any[][];

                ftsRows = rawRows.map(row => ({
                    id: row[0] as string,
                    matchedSnippet: row[1] as string,
                    score: -(row[2] as number), // Invert rank to match our 'higher is better' score logic
                }));
            } else {
                // Mobile: expo-sqlite natively handles raw named columns
                ftsRows = await db.all<FtsRow>(sql`
                    SELECT
                        id,
                        snippet(notes_fts, 3, '', '', '...', 20) AS matchedSnippet,
                        -bm25(notes_fts)                          AS score
                    FROM notes_fts
                    WHERE notes_fts MATCH ${ftsQuery}
                    ORDER BY score DESC
                    ${limit ? sql`LIMIT ${limit * 2}` : sql``}
                `);
            }

            if (ftsRows.length === 0) return [];

            // Dedup in JS — keep first occurrence per id (highest score wins)
            const seen = new Set<string>();
            const deduped: FtsRow[] = [];
            for (const row of ftsRows) {
                if (row.id && !seen.has(row.id)) {
                    seen.add(row.id);
                    deduped.push(row);
                }
            }

            const ids = deduped.map((r: FtsRow) => r.id);
            const ftsMap = new Map<string, FtsRow>(deduped.map((r: FtsRow) => [r.id, r]));

            // Pass 2: fetch metadata via Drizzle (type-safe, no FTS aux functions)
            const metaConditions = [
                inArray(schema.noteMetadata.id, ids),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false),
                ...(folderId ? [eq(schema.noteMetadata.folderId, folderId)] : []),
            ];

            const metaRows: MetaRow[] = await db.select({
                id: schema.noteMetadata.id,
                title: schema.noteMetadata.title,
                preview: schema.noteMetadata.preview,
                folderId: schema.noteMetadata.folderId,
                updatedAt: schema.noteMetadata.updatedAt,
            })
                .from(schema.noteMetadata)
                .where(and(...metaConditions))
                .all();

            // Merge and re-sort by FTS score (metadata query loses ordering)
            const merged: NoteSearchRow[] = metaRows
                .filter((m: MetaRow) => m.id !== null)
                .map((m: MetaRow) => ({
                    id: m.id!,
                    title: m.title,
                    preview: m.preview,
                    folderId: m.folderId,
                    updatedAt: m.updatedAt,
                    matchedSnippet: ftsMap.get(m.id!)?.matchedSnippet ?? null,
                    score: ftsMap.get(m.id!)?.score ?? 0,
                }))
                .sort((a: NoteSearchRow, b: NoteSearchRow) =>
                    b.score !== a.score
                        ? b.score - a.score
                        : (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
                );

            return limit ? merged.slice(0, limit) : merged;
        };

        // PASS 1: Strict Mode — require ALL words to match (AND)
        let ftsQuery = this._buildFtsQuery(query, 'AND', false);
        let results = await executeSearch(ftsQuery);

        // PASS 2: Waterfall Fallback — OR search with stop words stripped
        if (results.length === 0) {
            ftsQuery = this._buildFtsQuery(query, 'OR', true);
            if (ftsQuery !== '""') {
                results = await executeSearch(ftsQuery, 10);
            }
        }

        return results;
    },

    /**
     * Lightweight FTS query for AI context retrieval.
     */
    async findRelevantNoteIds(query: string, folderNoteIds?: string[], limit = 3): Promise<string[]> {
        const ftsQuery = this._buildFtsQuery(query, 'OR', true);

        if (ftsQuery === '""') return [];

        const dbStore = useDbStore.getState();
        const isDesktop = (dbStore.nativeDb as any)?.selectAsync !== undefined;
        let ids: string[] = [];

        if (isDesktop) {
            // Desktop bypass for raw FTS group query
            const rawRows = await (dbStore.nativeDb as any).selectAsync(
                `SELECT id
                FROM notes_fts
                WHERE notes_fts MATCH ?
                GROUP BY id
                ORDER BY rank
                LIMIT ${limit * 3}`,
                [ftsQuery]
            ) as any[][];

            ids = rawRows.map(row => row[0] as string).filter(Boolean);
        } else {
            // Mobile standard Drizzle
            const ftsRows = await getDb().all<{ id: string }>(sql`
                SELECT id
                FROM notes_fts
                WHERE notes_fts MATCH ${ftsQuery}
                GROUP BY id
                ORDER BY rank
                LIMIT ${limit * 3}
            `);
            ids = ftsRows.map((r: any) => r.id).filter(Boolean);
        }

        // Filter to folder scope if provided
        if (folderNoteIds && folderNoteIds.length > 0) {
            const folderSet = new Set(folderNoteIds);
            ids = ids.filter((id: string) => folderSet.has(id));
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
    },

    /**
     * Finds all notes that contain at least one uncompleted task item
     * (data-checked="false"), using FTS5 for fast pre-filtering.
     * Returns parsed task groups per note.
     */
    async findNotesWithPendingTasks(): Promise<PendingTaskNote[]> {
        const dbStore = useDbStore.getState();
        const isDesktop = (dbStore.nativeDb as any)?.selectAsync !== undefined;

        // Step 1: Fast FTS5 pre-filter — find notes that contain the word "false"
        // in their content (from data-checked="false"). This is an efficient heuristic.
        let candidateIds: string[] = [];

        if (isDesktop) {
            const rawRows = await (dbStore.nativeDb as any).selectAsync(
                `SELECT id FROM notes_fts WHERE notes_fts MATCH '"false"' GROUP BY id ORDER BY rank`,
                []
            ) as any[][];
            candidateIds = rawRows.map(row => row[0] as string).filter(Boolean);
        } else {
            const ftsRows = await getDb().all<{ id: string }>(sql`
                SELECT id FROM notes_fts WHERE notes_fts MATCH '"false"' GROUP BY id ORDER BY rank
            `);
            candidateIds = ftsRows.map((r: any) => r.id).filter(Boolean);
        }

        if (candidateIds.length === 0) return [];

        // Step 2: Validate metadata (not deleted)
        const validMeta = await getDb()
            .select({ id: schema.noteMetadata.id, title: schema.noteMetadata.title, folderId: schema.noteMetadata.folderId, createdAt: schema.noteMetadata.createdAt })
            .from(schema.noteMetadata)
            .where(and(
                inArray(schema.noteMetadata.id, candidateIds),
                eq(schema.noteMetadata.isDeleted, false),
                eq(schema.noteMetadata.isPermDeleted, false),
            ))
            .all();

        const validMetaRows = safeGetAll<{ id: string; title: string | null; folderId: string | null; createdAt: Date | null }>(validMeta);
        if (validMetaRows.length === 0) return [];

        // Step 3: Fetch full HTML content for validated notes only
        const validIds = validMetaRows.map(m => m.id);
        const contentRows = await getDb()
            .select({ id: schema.noteContent.id, content: schema.noteContent.content })
            .from(schema.noteContent)
            .where(inArray(schema.noteContent.id, validIds))
            .all();

        type MetaItem = { id: string; title: string | null; folderId: string | null; createdAt: Date | null };
        const contentMap = new Map<string, string>(
            safeGetAll<{ id: string; content: string }>(contentRows).map((r: { id: string; content: string }) => [r.id, r.content])
        );
        const metaMap = new Map<string, MetaItem>(validMetaRows.map((m: MetaItem) => [m.id, m]));

        const results: PendingTaskNote[] = [];

        for (const noteId of validIds) {
            const html = contentMap.get(noteId) ?? '';
            // Quick bail: if no unchecked task items, skip expensive parsing
            if (!html.includes('data-checked="false"')) continue;

            const tasks = parsePendingTasks(html);
            if (tasks.length === 0) continue;

            const meta = metaMap.get(noteId)!;
            results.push({
                noteId,
                noteTitle: meta.title ?? 'Untitled Note',
                folderId: meta.folderId,
                createdAt: meta.createdAt,
                tasks,
            });
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
function parsePendingTasks(html: string): PendingTask[] {
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