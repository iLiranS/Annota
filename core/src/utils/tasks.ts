import { TaskInsert } from "../db/schema";
import { generateId } from './id';

export const generateTask = (data: Partial<TaskInsert>): TaskInsert => {
    const id = generateId();
    const now = new Date();
    return {
        title: data.title ?? '',
        deadline: data.deadline ?? now,
        id,
        createdAt: now,
        updatedAt: now,
        isDirty: true,
        isPermDeleted: data.isPermDeleted ?? false,
        description: data.description ?? '',
        isWholeDay: data.isWholeDay ?? false,
        completed: data.completed ?? false,
        completedAt: data.completedAt ?? (data.completed ? now : null),
        folderId: data.folderId ?? null,
        links: data.links ?? '[]',
    };
}
