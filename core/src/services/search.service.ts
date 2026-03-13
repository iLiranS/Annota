import { SearchRepository } from '../db/repositories/search.repository';
import { safeGetAll } from '../db/utils';

export type UnifiedSearchResult = {
    type: 'note' | 'task' | 'folder' | 'action';
    id: string;
    title: string;
    subtitle?: string; // Maps to note.preview or task.description
    score: number;
    updatedAt: Date;
    data: any; // Original metadata object
    actionType?: 'create_note' | 'create_task';
    folderId?: string;
};

export const SearchService = {
    async executeSearch(query: string, scope: 'all' | 'current', currentFolderId: string | null): Promise<UnifiedSearchResult[]> {
        if (!query.trim()) return [];

        const folderFilter = scope === 'current' ? currentFolderId : null;

        // Run all queries concurrently
        const [notesRaw, tasksRaw, foldersRaw] = await Promise.all([
            SearchRepository.searchNotes(query, folderFilter),
            SearchRepository.searchTasks(query, folderFilter),
            SearchRepository.searchFolders(query)
        ]);

        const safeNotes = safeGetAll<any>(notesRaw);
        const safeTasks = safeGetAll<any>(tasksRaw);
        const safeFolders = safeGetAll<any>(foldersRaw);

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

        const normalizedFolders: UnifiedSearchResult[] = safeFolders.map(f => ({
            type: 'folder',
            id: f.id,
            title: f.name,
            score: f.score,
            updatedAt: f.updatedAt,
            data: f
        }));

        // Combine and sort globally by score (primary) and updatedAt (secondary)
        let combined = [...normalizedNotes, ...normalizedTasks, ...normalizedFolders].sort((a, b) => {
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
            if ((item.type === 'note' || item.type === 'task') && item.data.folderId) {
                if (highRankFolderIds.has(item.data.folderId) && item.score < 4) {
                    return false;
                }
            }
            return true;
        });

        return combined;
    }
};
