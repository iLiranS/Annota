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
export function sortNotes<T extends { title: string; createdAt: Date; updatedAt: Date }>(notes: T[], sortType: SortType): T[] {
    return [...notes].sort((a, b) => {
        switch (sortType) {
            case 'NAME_ASC':
                return a.title.localeCompare(b.title);
            case 'NAME_DESC':
                return b.title.localeCompare(a.title);
            case 'CREATED_FIRST':
                return a.createdAt.getTime() - b.createdAt.getTime();
            case 'CREATED_LAST':
                return b.createdAt.getTime() - a.createdAt.getTime();
            case 'UPDATED_FIRST':
                return a.updatedAt.getTime() - b.updatedAt.getTime();
            case 'UPDATED_LAST':
                return b.updatedAt.getTime() - a.updatedAt.getTime();
            default:
                return 0;
        }
    });
}

/**
 * Sort folders by the specified sort type
 */
export function sortFolders<T extends { name: string; createdAt: Date; updatedAt: Date }>(folders: T[], sortType: SortType): T[] {
    return [...folders].sort((a, b) => {
        switch (sortType) {
            case 'NAME_ASC':
                return a.name.localeCompare(b.name);
            case 'NAME_DESC':
                return b.name.localeCompare(a.name);
            case 'CREATED_FIRST':
                return a.createdAt.getTime() - b.createdAt.getTime();
            case 'CREATED_LAST':
                return b.createdAt.getTime() - a.createdAt.getTime();
            case 'UPDATED_FIRST':
                return a.updatedAt.getTime() - b.updatedAt.getTime();
            case 'UPDATED_LAST':
                return b.updatedAt.getTime() - a.updatedAt.getTime();
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