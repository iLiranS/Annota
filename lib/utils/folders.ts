import * as Crypto from 'expo-crypto';
import { FolderInsert } from "../db/schema";

export const generateFolder = (data: Partial<FolderInsert>): FolderInsert => {
    const id = Crypto.randomUUID();
    const now = new Date();

    return {
        id,
        parentId: data?.parentId,
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