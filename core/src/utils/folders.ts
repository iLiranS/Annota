import { FolderInsert } from "../db/schema";
import { generateId } from './id';
import { createStorageAdapter } from "../stores/config";

export const generateFolder = (data: Partial<FolderInsert>): FolderInsert => {
    const id = generateId();
    const now = new Date();

    return {
        id,
        parentId: data?.parentId ?? null,
        name: data?.name ?? 'New Folder',
        icon: data?.icon ?? 'folder',
        color: data?.color ?? '#F59E0B',
        createdAt: now,
        updatedAt: now,
        isDirty: true,
        sortType: 'CREATED_FIRST',
        isDeleted: false,
        isSystem: false,
    };
}

export async function cleanFolderExpandedState(folderId: string | string[]) {
    const ids = Array.isArray(folderId) ? folderId : [folderId];

    // 1. Desktop cleanup (localStorage keys)
    if (typeof window !== 'undefined' && window.localStorage) {
        for (const id of ids) {
            window.localStorage.removeItem(`sidebar_folder_open_${id}`);
        }
    }

    // 2. Mobile cleanup (AsyncStorage array via unified adapter)
    try {
        const storage = createStorageAdapter();
        const value = await storage.getItem('sidebar_expanded_folders');
        if (value) {
            const expandedList = JSON.parse(value);
            if (Array.isArray(expandedList)) {
                const idsToRemove = new Set(ids);
                const nextList = expandedList.filter(id => !idsToRemove.has(id));
                if (nextList.length !== expandedList.length) {
                    await storage.setItem('sidebar_expanded_folders', JSON.stringify(nextList));
                }
            }
        }
    } catch (err) {
        console.warn('[Storage] Failed to cleanup sidebar_expanded_folders:', err);
    }
}


