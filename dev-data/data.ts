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

export interface Note {
    id: string;
    title: string;
    content: string;
    preview: string;
    folderId: string | null; // null = root level
    isDeleted: boolean;
    deletedAt: Date | null;
    originalFolderId?: string | null; // Original location before deletion
    createdAt: Date;
    updatedAt: Date;
}

export interface Folder {
    id: string;
    name: string;
    icon: string; // Ionicons icon name (e.g., 'folder', 'folder-open', 'briefcase')
    parentId: string | null; // null = root level (unlimited nesting)
    sortType: SortType;
    isSystem: boolean; // true for Trash folder (cannot be deleted/renamed)
    isDeleted: boolean;
    deletedAt: Date | null;
    originalParentId?: string | null; // Original parent before deletion
    createdAt: Date;
    updatedAt: Date;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    deadline: Date;
    completed: boolean;
    folderId: string | null; // optional folder association
    createdAt: Date;
}

// =====================
// DUMMY DATA
// =====================

// System folder IDs
export const TRASH_FOLDER_ID = 'system-trash';

export const DUMMY_FOLDERS: Folder[] = [
    // System folder - Trash (cannot be deleted or renamed)
    {
        id: TRASH_FOLDER_ID,
        name: 'Trash',
        icon: 'trash',
        parentId: null,
        sortType: 'UPDATED_LAST',
        isSystem: true,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01')
    },
    // Regular folders
    { id: 'folder-1', name: 'Work', icon: 'briefcase', parentId: null, sortType: 'UPDATED_LAST', isSystem: false, isDeleted: false, deletedAt: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
    { id: 'folder-2', name: 'Personal', icon: 'person', parentId: null, sortType: 'UPDATED_LAST', isSystem: false, isDeleted: false, deletedAt: null, createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02') },
    { id: 'folder-3', name: 'Projects', icon: 'folder', parentId: 'folder-1', sortType: 'UPDATED_LAST', isSystem: false, isDeleted: false, deletedAt: null, createdAt: new Date('2026-01-03'), updatedAt: new Date('2026-01-03') }, // nested in Work
    { id: 'folder-4', name: 'Meetings', icon: 'calendar', parentId: 'folder-1', sortType: 'UPDATED_LAST', isSystem: false, isDeleted: false, deletedAt: null, createdAt: new Date('2026-01-04'), updatedAt: new Date('2026-01-04') }, // nested in Work
    { id: 'folder-5', name: 'Archive', icon: 'archive', parentId: 'folder-3', sortType: 'UPDATED_LAST', isSystem: false, isDeleted: false, deletedAt: null, createdAt: new Date('2026-01-05'), updatedAt: new Date('2026-01-05') }, // nested in Projects (2 levels deep)
];

export const DUMMY_NOTES: Note[] = [
    {
        id: 'note-1',
        title: 'Project Research',
        content: '<p>Project Research</p><p>Gathered initial requirements for the new dashboard including user interviews and competitor analysis.</p>',
        preview: 'Gathered initial requirements for the new dashboard...',
        folderId: 'folder-3', // in Projects folder
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-14T10:00:00'),
        updatedAt: new Date('2026-01-14T14:30:00'),
    },
    {
        id: 'note-2',
        title: 'Weekly Groceries',
        content: '<p>Weekly Groceries</p><p>Milk, eggs, sourdough bread, avocados, spinach, chicken breast, olive oil, garlic.</p>',
        preview: 'Milk, eggs, sourdough bread, avocados...',
        folderId: 'folder-2', // in Personal folder
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-14T08:00:00'),
        updatedAt: new Date('2026-01-14T08:00:00'),
    },
    {
        id: 'note-3',
        title: 'Workout Routine',
        content: '<p>Workout Routine</p><p>Upper body focus: Bench press 4x8, Pull ups 3x10, Shoulder press 3x12, Dumbbell rows 3x10.</p>',
        preview: 'Upper body focus: Bench press, Pull ups...',
        folderId: null, // root level (unfoldered)
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-13T07:00:00'),
        updatedAt: new Date('2026-01-13T07:00:00'),
    },
    {
        id: 'note-4',
        title: 'Book Recommendations',
        content: '<p>Book Recommendations</p><p>Clean Code by Robert Martin, The Pragmatic Programmer, Designing Data-Intensive Applications.</p>',
        preview: 'Clean Code, The Pragmatic Programmer...',
        folderId: null, // root level (unfoldered)
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-12T19:00:00'),
        updatedAt: new Date('2026-01-12T19:00:00'),
    },
    {
        id: 'note-5',
        title: 'Q1 Planning Notes',
        content: '<p>Q1 Planning Notes</p><p>Main goals for Q1: Launch MVP, hire 2 engineers, close Series A round.</p>',
        preview: 'Main goals for Q1: Launch MVP, hire 2 engineers...',
        folderId: 'folder-4', // in Meetings folder
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-10T15:00:00'),
        updatedAt: new Date('2026-01-15T10:00:00'),
    },
    {
        id: 'note-6',
        title: 'Archived Specs',
        content: '<p>Archived Specs</p><p>Old specifications from v1.0 release. Kept for reference.</p>',
        preview: 'Old specifications from v1.0 release...',
        folderId: 'folder-5', // in Archive folder (deeply nested)
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-05T12:00:00'),
        updatedAt: new Date('2026-01-05T12:00:00'),
    },
];

export const DUMMY_TASKS: Task[] = [
    {
        id: 'task-1',
        title: 'Review PR #234',
        description: 'Code review for authentication module refactor',
        deadline: new Date('2026-01-16T18:00:00'), // Today
        completed: false,
        folderId: 'folder-3',
        createdAt: new Date('2026-01-15T09:00:00'),
    },
    {
        id: 'task-2',
        title: 'Grocery shopping',
        description: 'Pick up items from the weekly list',
        deadline: new Date('2026-01-16T20:00:00'), // Today
        completed: true,
        folderId: 'folder-2',
        createdAt: new Date('2026-01-14T08:00:00'),
    },
    {
        id: 'task-3',
        title: 'Prepare presentation slides',
        description: 'Q1 goals presentation for team meeting',
        deadline: new Date('2026-01-17T10:00:00'), // Tomorrow
        completed: false,
        folderId: 'folder-4',
        createdAt: new Date('2026-01-13T14:00:00'),
    },
    {
        id: 'task-4',
        title: 'Schedule dentist appointment',
        description: 'Annual checkup - call Dr. Smith office',
        deadline: new Date('2026-01-18T12:00:00'),
        completed: false,
        folderId: null,
        createdAt: new Date('2026-01-10T11:00:00'),
    },
    {
        id: 'task-5',
        title: 'Finish reading Clean Code',
        description: 'Complete chapters 10-14',
        deadline: new Date('2026-01-20T23:59:00'),
        completed: false,
        folderId: null,
        createdAt: new Date('2026-01-08T20:00:00'),
    },
    {
        id: 'task-6',
        title: 'Submit expense report',
        description: 'December travel expenses',
        deadline: new Date('2026-01-15T17:00:00'), // Overdue (yesterday)
        completed: false,
        folderId: null,
        createdAt: new Date('2026-01-05T10:00:00'),
    },
];

// =====================
// HELPER FUNCTIONS
// =====================

/**
 * Get notes that are direct children of a folder (or root if folderId is null)
 */
export function getNotesInFolder(folderId: string | null): Note[] {
    return DUMMY_NOTES.filter((note) => note.folderId === folderId);
}

/**
 * Get folders that are direct children of a parent folder (or root if parentId is null)
 */
export function getFoldersInFolder(parentId: string | null): Folder[] {
    return DUMMY_FOLDERS.filter((folder) => folder.parentId === parentId);
}

/**
 * Get a folder by ID
 */
export function getFolderById(folderId: string): Folder | undefined {
    return DUMMY_FOLDERS.find((folder) => folder.id === folderId);
}

/**
 * Get a note by ID
 */
export function getNoteById(noteId: string): Note | undefined {
    return DUMMY_NOTES.find((note) => note.id === noteId);
}

/**
 * Get tasks for a specific date (matches by day, ignoring time)
 */
export function getTasksByDate(date: Date): Task[] {
    return DUMMY_TASKS.filter((task) => {
        const taskDate = new Date(task.deadline);
        return (
            taskDate.getFullYear() === date.getFullYear() &&
            taskDate.getMonth() === date.getMonth() &&
            taskDate.getDate() === date.getDate()
        );
    });
}

/**
 * Get all tasks sorted by deadline (soonest first)
 */
export function getTasksSortedByDeadline(): Task[] {
    return [...DUMMY_TASKS].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

/**
 * Get dates in a month that have tasks (for calendar highlighting)
 */
export function getTaskDatesInMonth(year: number, month: number): Set<number> {
    const taskDates = new Set<number>();
    DUMMY_TASKS.forEach((task) => {
        const taskDate = new Date(task.deadline);
        if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
            taskDates.add(taskDate.getDate());
        }
    });
    return taskDates;
}

/**
 * Sort notes by the specified sort type
 */
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