import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '../../stores/db.store';
import type { Task, TaskInsert } from '../schema';
import * as schema from '../schema';
import type { DbOrTx } from '../types';
import { safeGet, safeGetAll } from '../utils';

// Re-export types
export type { Task } from '../schema';

// Input type for creating tasks (now just pure data)
export interface CreateTaskInput {
    id: string; // ID is now required here
    title: string;
    description?: string;
    deadline: Date;
    folderId?: string | null;
    isWholeDay?: boolean;
}

// ============ SYNC OPERATIONS ============

export async function getDirtyTasks(): Promise<Task[]> {
    const result = await getDb().select().from(schema.tasks).where(eq(schema.tasks.isDirty, true)).all();
    return safeGetAll<Task>(result);
}

export async function clearDirtyTasks(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await getDb().update(schema.tasks)
        .set({ isDirty: false })
        .where(inArray(schema.tasks.id, taskIds))
        .run();
}

export async function upsertSyncedTask(taskData: Task, tx: DbOrTx = getDb()): Promise<void> {
    const result = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, taskData.id)).get();
    const existing = safeGet<Task>(result);
    if (existing && existing.updatedAt > taskData.updatedAt) {
        console.log(`[Sync] Local task ${taskData.id} is newer, ignoring pulled row. Local: ${existing.updatedAt}, Pulled: ${taskData.updatedAt}`);
        return;
    }

    await tx.insert(schema.tasks)
        .values(taskData)
        .onConflictDoUpdate({ target: schema.tasks.id, set: taskData })
        .run();
}

// ============ TASK OPERATIONS ============

export async function getAllTasks(): Promise<Task[]> {
    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.isPermDeleted, false))
        .all();
    return safeGetAll<Task>(result);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, taskId))
        .get();

    return safeGet<Task>(result);
}

export async function getTasksByDate(date: Date): Promise<Task[]> {
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(
            and(
                gte(schema.tasks.deadline, startOfDay),
                lt(schema.tasks.deadline, new Date(endOfDay.getTime() + 1)),
                eq(schema.tasks.isPermDeleted, false)
            )
        )
        .all();
    return safeGetAll<Task>(result);
}

export async function getTasksSortedByDeadline(): Promise<Task[]> {
    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.isPermDeleted, false))
        .orderBy(asc(schema.tasks.deadline))
        .all();
    return safeGetAll<Task>(result);
}

export async function getPendingTasks(): Promise<Task[]> {
    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(
            and(
                eq(schema.tasks.completed, false),
                eq(schema.tasks.isPermDeleted, false)
            )
        )
        .orderBy(asc(schema.tasks.deadline))
        .all();
    return safeGetAll<Task>(result);
}

export async function getCompletedTasks(): Promise<Task[]> {
    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(
            and(
                eq(schema.tasks.completed, true),
                eq(schema.tasks.isPermDeleted, false)
            )
        )
        .orderBy(asc(schema.tasks.deadline))
        .all();
    return safeGetAll<Task>(result);
}

export async function createTask(data: TaskInsert): Promise<Task> {
    await getDb().insert(schema.tasks).values(data).run();

    const result = await getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, data.id))
        .get();

    const task = safeGet<Task>(result);
    return task!;
}

export async function updateTask(
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<void> {
    if ('completed' in updates && !('completedAt' in updates)) {
        updates.completedAt = updates.completed ? new Date() : null;
    }

    await getDb()
        .update(schema.tasks)
        .set({ ...updates, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export async function deleteTask(taskId: string): Promise<void> {
    await getDb().update(schema.tasks)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export async function toggleTaskComplete(taskId: string): Promise<void> {
    const task = await getTaskById(taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    const newCompletedAt = newCompleted ? new Date() : null;

    await getDb()
        .update(schema.tasks)
        .set({
            completed: newCompleted,
            completedAt: newCompletedAt,
            isDirty: true,
            updatedAt: new Date()
        })
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export async function deleteCompletedTasks(): Promise<void> {
    await getDb().update(schema.tasks)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.tasks.completed, true))
        .run();
}

export async function clearCompletedSince(date: Date): Promise<void> {
    await getDb().update(schema.tasks)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(
            and(
                eq(schema.tasks.completed, true),
                lt(schema.tasks.completedAt, date)
            )
        )
        .run();
}

// ============ COUNT OPERATIONS ============

export async function getTasksCount(tx: DbOrTx = getDb()): Promise<number> {
    const result = await tx.select({ count: sql<number>`count(*)` })
        .from(schema.tasks)
        .where(eq(schema.tasks.isPermDeleted, false))
        .get();
    const safeResult = safeGet<{ count: number }>(result);
    return safeResult?.count ?? 0;
}

// ============ CALENDAR HELPERS ============

export async function getTaskDatesInMonth(year: number, month: number): Promise<Set<number>> {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const tasks = await getDb()
        .select()
        .from(schema.tasks)
        .where(
            and(
                gte(schema.tasks.deadline, startOfMonth),
                lt(schema.tasks.deadline, new Date(endOfMonth.getTime() + 1)),
                eq(schema.tasks.isPermDeleted, false)
            )
        )
        .all();

    const safeTasks = safeGetAll<Task>(tasks);

    const dates = new Set<number>();
    for (const task of safeTasks) {
        dates.add(task.deadline.getDate());
    }

    return dates;
}
