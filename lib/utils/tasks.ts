import * as Crypto from 'expo-crypto';
import { TaskInsert } from "../db/schema";

export const generateTask = (data: Partial<TaskInsert>): TaskInsert => {
    const id = Crypto.randomUUID();
    const now = new Date();
    return {
        title: data.title ?? '',
        deadline: data.deadline ?? now,
        id,
        createdAt: now,
        updatedAt: now,
        isDirty: true,
        description: data.description ?? '',
        isWholeDay: data.isWholeDay ?? false,
        completed: data.completed ?? false,
        completedAt: data.completedAt ?? (data.completed ? now : null),
        folderId: data.folderId ?? null,
        links: data.links ?? '[]',
        lastSyncedAt: data.lastSyncedAt ?? null,
    };
}