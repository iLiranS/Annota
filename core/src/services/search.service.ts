import { SearchRepository, type PendingTaskNote } from '../db/repositories/search.repository';
import { safeGetAll } from '../db/utils';
import { stripHtml } from '../utils';

export type UnifiedSearchResult = {
    type: 'note' | 'folder' | 'action';
    id: string;
    title: string;
    subtitle?: string; // Maps to note.preview or task.description
    score: number;
    updatedAt: Date;
    data: any; // Original metadata object
    actionType?: 'create_note';
    folderId?: string;
};

export const SearchService = {
    async executeSearch(query: string, scope: 'all' | 'current', currentFolderId: string | null): Promise<UnifiedSearchResult[]> {
        if (!query.trim()) return [];

        const folderFilter = scope === 'current' ? currentFolderId : null;

        // Run all queries concurrently
        const [notesRaw, foldersRaw] = await Promise.all([
            SearchRepository.searchNotes(query, folderFilter),
            SearchRepository.searchFolders(query)
        ]);

        const safeNotes = safeGetAll<any>(notesRaw);
        const safeFolders = safeGetAll<any>(foldersRaw);

        const normalizedNotes: UnifiedSearchResult[] = safeNotes.map(n => {
            // FTS handles relevance — use the snippet if available, otherwise fallback to preview
            let subtitle = n.matchedSnippet ? stripHtml(n.matchedSnippet) : n.preview;

            let parsedDate: Date;
            if (n.updatedAt instanceof Date) {
                parsedDate = n.updatedAt;
            } else if (typeof n.updatedAt === 'number') {
                parsedDate = new Date(n.updatedAt < 10000000000 ? n.updatedAt * 1000 : n.updatedAt);
            } else if (typeof n.updatedAt === 'string') {
                const num = Number(n.updatedAt);
                if (!isNaN(num)) {
                    parsedDate = new Date(num < 10000000000 ? num * 1000 : num);
                } else {
                    parsedDate = new Date(n.updatedAt);
                }
            } else {
                parsedDate = new Date();
            }

            return {
                type: 'note',
                id: n.id,
                title: n.title,
                subtitle,
                score: n.score,
                updatedAt: parsedDate,
                data: {
                    ...n,
                    updatedAt: parsedDate
                }
            };
        });

        const normalizedFolders: UnifiedSearchResult[] = safeFolders.map(f => {
            let parsedDate: Date;
            if (f.updatedAt instanceof Date) {
                parsedDate = f.updatedAt;
            } else if (typeof f.updatedAt === 'number') {
                parsedDate = new Date(f.updatedAt < 10000000000 ? f.updatedAt * 1000 : f.updatedAt);
            } else if (typeof f.updatedAt === 'string') {
                const num = Number(f.updatedAt);
                if (!isNaN(num)) {
                    parsedDate = new Date(num < 10000000000 ? num * 1000 : num);
                } else {
                    parsedDate = new Date(f.updatedAt);
                }
            } else {
                parsedDate = new Date();
            }

            return {
                type: 'folder',
                id: f.id,
                title: f.name,
                score: f.score,
                updatedAt: parsedDate,
                data: {
                    ...f,
                    updatedAt: parsedDate
                }
            };
        });

        // Combine and sort globally by score (primary) and updatedAt (secondary)
        let combined = [...normalizedNotes, ...normalizedFolders].sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        });

        const highRankFolderIds = new Set(
            combined
                .filter(item => item.type === 'folder' && item.score >= 3)
                .map(f => f.id)
        );

        // Suppress lower-score items that belong to highly-ranked folders
        combined = combined.filter(item => {
            if (item.type === 'note' && item.data.folderId) {
                if (highRankFolderIds.has(item.data.folderId) && item.score < 4) {
                    return false;
                }
            }
            return true;
        });

        return combined;
    },

    async findNotesWithPendingTasks(): Promise<PendingTaskNote[]> {
        return await SearchRepository.findNotesWithPendingTasks();
    }
};
