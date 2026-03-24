// =====================
// INTERFACES
// =====================

export type SortType =
    | 'NAME_ASC'
    | 'NAME_DESC'
    | 'CREATED_FIRST'
    | 'CREATED_LAST'
    | 'UPDATED_FIRST'
    | 'UPDATED_LAST';

/**
 * Sort notes by the specified sort type
 */
export function sortNotes<T extends { title?: string | null; createdAt: any; updatedAt: any }>(notes: T[], sortType: SortType): T[] {
    const getTs = (d: any) => d ? new Date(d).getTime() : 0;

    return [...notes].sort((a, b) => {
        switch (sortType) {
            case 'NAME_ASC':
                return (a.title || '').localeCompare(b.title || '');
            case 'NAME_DESC':
                return (b.title || '').localeCompare(a.title || '');
            case 'CREATED_FIRST':
                return getTs(a.createdAt) - getTs(b.createdAt);
            case 'CREATED_LAST':
                return getTs(b.createdAt) - getTs(a.createdAt);
            case 'UPDATED_FIRST':
                return getTs(a.updatedAt) - getTs(b.updatedAt);
            case 'UPDATED_LAST':
                return getTs(b.updatedAt) - getTs(a.updatedAt);
            default:
                return 0;
        }
    });
}

/**
 * Sort folders by the specified sort type
 */
export function sortFolders<T extends { name: string; createdAt: any; updatedAt: any }>(folders: T[], sortType: SortType): T[] {
    const getTs = (d: any) => d ? new Date(d).getTime() : 0;

    return [...folders].sort((a, b) => {
        switch (sortType) {
            case 'NAME_ASC':
                return (a.name || '').localeCompare(b.name || '');
            case 'NAME_DESC':
                return (b.name || '').localeCompare(a.name || '');
            case 'CREATED_FIRST':
                return getTs(a.createdAt) - getTs(b.createdAt);
            case 'CREATED_LAST':
                return getTs(b.createdAt) - getTs(a.createdAt);
            case 'UPDATED_FIRST':
                return getTs(a.updatedAt) - getTs(b.updatedAt);
            case 'UPDATED_LAST':
                return getTs(b.updatedAt) - getTs(a.updatedAt);
            default:
                return 0;
        }
    });
}

/**
 * Get human-readable label for sort type
 */
export function getSortTypeLabel(sortType: SortType): string {
    switch (sortType) {
        case 'NAME_ASC':
            return 'Name (A → Z)';
        case 'NAME_DESC':
            return 'Name (Z → A)';
        case 'CREATED_FIRST':
            return 'Created (Oldest)';
        case 'CREATED_LAST':
            return 'Created (Newest)';
        case 'UPDATED_FIRST':
            return 'Updated (Oldest)';
        case 'UPDATED_LAST':
            return 'Updated (Newest)';
        default:
            return 'Unknown';
    }
}