import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { db, schema } from '../client';
import type { Task, TaskInsert } from '../schema';

// Re-export types
export type { Task } from '../schema';

// Input type for creating tasks (now just pure data)
export interface CreateTaskInput {
    id: string; // ID is now required here
    title: string;
    description?: string;
    deadline: Date;
    linkedNoteId?: string | null;
    isWholeDay?: boolean;
}

// ============ TASK OPERATIONS ============

export function getAllTasks(): Task[] {
    return db
        .select()
        .from(schema.tasks)
        .all();
}

export function getTaskById(taskId: string): Task | null {
    const result = db
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

    return db
        .select()
        .from(schema.tasks)
        .where(
            and(
                gte(schema.tasks.deadline, startOfDay),
                lt(schema.tasks.deadline, new Date(endOfDay.getTime() + 1))
            )
        )
        .all();
}

export function getTasksSortedByDeadline(): Task[] {
    return db
        .select()
        .from(schema.tasks)
        .orderBy(asc(schema.tasks.deadline))
        .all();
}

export function getPendingTasks(): Task[] {
    return db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.completed, false))
        .orderBy(asc(schema.tasks.deadline))
        .all();
}

export function getCompletedTasks(): Task[] {
    return db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.completed, true))
        .orderBy(asc(schema.tasks.deadline))
        .all();
}

export function createTask(data: CreateTaskInput): Task {
    const now = new Date();

    const taskData: TaskInsert = {
        id: data.id,
        title: data.title || 'Untitled Task',
        description: data.description || '',
        deadline: data.deadline,
        completed: false,
        linkedNoteId: data.linkedNoteId || null,
        isWholeDay: data.isWholeDay || false,
        createdAt: now,
    };

    db.insert(schema.tasks).values(taskData).run();

    return db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, data.id))
        .get()!;
}

export function updateTask(
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt'>>
): void {
    db
        .update(schema.tasks)
        .set(updates)
        .where(eq(schema.tasks.id, taskId))
        .run();
}

export function deleteTask(taskId: string): void {
    db.delete(schema.tasks).where(eq(schema.tasks.id, taskId)).run();
}

export function toggleTaskComplete(taskId: string): void {
    const task = getTaskById(taskId);
    if (!task) return;

    db
        .update(schema.tasks)
        .set({ completed: !task.completed })
        .where(eq(schema.tasks.id, taskId))
        .run();
}

// ============ CALENDAR HELPERS ============

export function getTaskDatesInMonth(year: number, month: number): Set<number> {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const tasks = db
        .select()
        .from(schema.tasks)
        .where(
            and(
                gte(schema.tasks.deadline, startOfMonth),
                lt(schema.tasks.deadline, new Date(endOfMonth.getTime() + 1))
            )
        )
        .all();

    const dates = new Set<number>();
    for (const task of tasks) {
        dates.add(task.deadline.getDate());
    }

    return dates;
}
