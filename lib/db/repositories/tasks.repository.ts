import { getDb } from '@/lib/stores/db.store';
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';
import { DbOrTx, schema } from '../client';
import type { Task, TaskInsert } from '../schema';

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

export function getDirtyTasks(): Task[] {
    return getDb().select().from(schema.tasks).where(eq(schema.tasks.isDirty, true)).all();
}

export function clearDirtyTasks(taskIds: string[], syncedAt: Date): void {
    if (taskIds.length === 0) return;
    getDb().update(schema.tasks)
        .set({ isDirty: false, lastSyncedAt: syncedAt })
        .where(inArray(schema.tasks.id, taskIds))
        .run();
}

export function upsertSyncedTask(taskData: Task, tx: DbOrTx = getDb()): void {
    tx.insert(schema.tasks)
        .values(taskData)
        .onConflictDoUpdate({ target: schema.tasks.id, set: taskData })
        .run();
}

// ============ TASK OPERATIONS ============

export function getAllTasks(): Task[] {
    return getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.isPermDeleted, false))
        .all();
}

export function getTaskById(taskId: string): Task | null {
    const result = getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, taskId))
        .get();

    return result ?? null;
}

export function getTasksByDate(date: Date): Task[] {
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return getDb()
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
}

export function getTasksSortedByDeadline(): Task[] {
    return getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.isPermDeleted, false))
        .orderBy(asc(schema.tasks.deadline))
        .all();
}

export function getPendingTasks(): Task[] {
    return getDb()
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
}

export function getCompletedTasks(): Task[] {
    return getDb()
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
}

export function createTask(data: TaskInsert): Task {
    getDb().insert(schema.tasks).values(data).run();

    return getDb()
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, data.id))
        .get()!;
}

export function updateTask(
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt'>>
): void {
    if ('completed' in updates && !('completedAt' in updates)) {
        updates.completedAt = updates.completed ? new Date() : null;
    }

    getDb()
        .update(schema.tasks)
        .set(updates)
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export function deleteTask(taskId: string): void {
    getDb().update(schema.tasks)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export function toggleTaskComplete(taskId: string): void {
    const task = getTaskById(taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    const newCompletedAt = newCompleted ? new Date() : null;

    getDb()
        .update(schema.tasks)
        .set({ completed: newCompleted, completedAt: newCompletedAt })
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export function deleteCompletedTasks(): void {
    getDb().update(schema.tasks)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(eq(schema.tasks.completed, true))
        .run();
}

export function clearCompletedSince(date: Date): void {
    getDb().update(schema.tasks)
        .set({ isPermDeleted: true, isDirty: true, updatedAt: new Date() })
        .where(
            and(
                eq(schema.tasks.completed, true),
                lt(schema.tasks.completedAt, date)
            )
        )
        .run();
}

// ============ CALENDAR HELPERS ============

export function getTaskDatesInMonth(year: number, month: number): Set<number> {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const tasks = getDb()
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

    const dates = new Set<number>();
    for (const task of tasks) {
        dates.add(task.deadline.getDate());
    }

    return dates;
}
