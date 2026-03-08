import { SearchRepository } from '../db/repositories/search.repository';
import { safeGetAll } from '../db/utils';

export type UnifiedSearchResult = {
    type: 'note' | 'task';
    id: string;
    title: string;
    subtitle?: string; // Maps to note.preview or task.description
    score: number;
    updatedAt: Date;
    data: any; // Original metadata object
};

export const SearchService = {
    async executeSearch(query: string, scope: 'all' | 'current', currentFolderId: string | null): Promise<UnifiedSearchResult[]> {
        if (!query.trim()) return [];

        const folderFilter = scope === 'current' ? currentFolderId : null;

        // Run both queries concurrently
        const [notesRaw, tasksRaw] = await Promise.all([
            SearchRepository.searchNotes(query, folderFilter),
            SearchRepository.searchTasks(query, folderFilter)
        ]);

        const safeNotes = safeGetAll<any>(notesRaw);
        const safeTasks = safeGetAll<any>(tasksRaw);

        // Wait, safeGetAll in core/src/db/utils.ts handles the quirks.
        // Let's use it correctly.

        const normalizedNotes: UnifiedSearchResult[] = safeNotes.map(n => ({
            type: 'note',
            id: n.id,
            title: n.title,
            subtitle: n.preview,
            score: n.score,
            updatedAt: n.updatedAt,
            data: n
        }));

        const normalizedTasks: UnifiedSearchResult[] = safeTasks.map(t => ({
            type: 'task',
            id: t.id,
            title: t.title,
            subtitle: t.description,
            score: t.score,
            updatedAt: t.updatedAt,
            data: t
        }));

        // Combine and sort globally by score (primary) and updatedAt (secondary)
        return [...normalizedNotes, ...normalizedTasks].sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
    }
};
