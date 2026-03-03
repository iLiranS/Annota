import { FolderInsert } from "../db/schema";
import { generateId } from './id';

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
        sortType: 'UPDATED_LAST',
        isDeleted: false,
        isSystem: false,
    };
}
