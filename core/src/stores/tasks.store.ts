import { create } from 'zustand';
import type { Task, TaskInsert } from '../db/schema';
import { TaskService } from '../services/tasks.service';
import { SyncScheduler } from '../sync/sync-scheduler';

// Re-export types
export type { Task, TaskInsert };

interface TasksState {
    // Data (cached from DB)
    tasks: Task[];

    // Load from DB
    loadTasks: () => Promise<void>;

    // Task operations
    createTask: (data: Partial<TaskInsert>) => Promise<Task>;
    updateTask: (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    toggleComplete: (taskId: string) => Promise<void>;
    clearCompletedTasks: () => Promise<void>;
    clearOldCompletedTasks: (date: Date) => Promise<void>;

    // Getters (operate on cached state)
    getTaskById: (taskId: string) => Task | undefined;
    getTasksByDate: (date: Date) => Task[];
    getTasksSortedByDeadline: () => Task[];
    getPendingTasks: () => Task[];
    getCompletedTasks: () => Task[];
    getTaskDatesInMonth: (year: number, month: number, pendingOnly?: boolean) => Set<number>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
    // Initial state (empty, will be populated from DB)
    tasks: [],

    // Load tasks from database
    loadTasks: async () => {
        const tasks = await TaskService.getAllTasks();
        set({ tasks });
    },

    // Task operations
    createTask: async (data) => {
        // Service handles ID generation and DB insertion
        const task = await TaskService.create(data);
        set((state) => ({
            tasks: [...state.tasks, task],
        }));
        SyncScheduler.instance?.notifyContentChange();
        return task;
    },

    updateTask: async (taskId: string, updates) => {
        await TaskService.update(taskId, updates);
        set((state) => ({
            tasks: state.tasks.map((task) => {
                if (task.id !== taskId) return task;

                let completedAt = task.completedAt;
                if ('completed' in updates && !('completedAt' in updates)) {
                    completedAt = updates.completed ? new Date() : null;
                } else if ('completedAt' in updates) {
                    completedAt = updates.completedAt ?? null;
                }

                return { ...task, ...updates, completedAt, isDirty: true, updatedAt: new Date() };
            }),
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    deleteTask: async (taskId: string) => {
        await TaskService.delete(taskId);
        set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId),
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    toggleComplete: async (taskId: string) => {
        await TaskService.toggleComplete(taskId);
        set((state) => ({
            tasks: state.tasks.map((task) => {
                if (task.id !== taskId) return task;
                const newCompleted = !task.completed;
                const newCompletedAt = newCompleted ? new Date() : null;
                return {
                    ...task,
                    completed: newCompleted,
                    completedAt: newCompletedAt,
                    isDirty: true,
                    updatedAt: new Date()
                };
            }),
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    clearCompletedTasks: async () => {
        await TaskService.clearCompleted();
        set((state) => ({
            tasks: state.tasks.filter((task) => !task.completed),
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    clearOldCompletedTasks: async (date: Date) => {
        const currentTasks = get().tasks;
        let clearedCount = 0;
        const newTasks = currentTasks.filter((task) => {
            let keep = true;
            if (task.completed && task.completedAt && task.completedAt < date) {
                keep = false;
                clearedCount++;
            }
            return keep;
        });

        if (clearedCount > 0) {
            console.log(`[DAILY_CLEANUP] Cleared ${clearedCount} old completed tasks.`);
            await TaskService.clearCompletedSince(date);
        }

        set({ tasks: newTasks });
        SyncScheduler.instance?.notifyContentChange();
    },

    // Getters (operate on cached state - same as before)
    getTaskById: (taskId: string) => {
        return get().tasks.find((task) => task.id === taskId);
    },

    getTasksByDate: (date: Date) => {
        return get().tasks.filter((task) => {
            const taskDate = new Date(task.deadline);
            return (
                taskDate.getFullYear() === date.getFullYear() &&
                taskDate.getMonth() === date.getMonth() &&
                taskDate.getDate() === date.getDate()
            );
        });
    },

    getTasksSortedByDeadline: () => {
        return [...get().tasks].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    },

    getPendingTasks: () => {
        return get()
            .tasks.filter((task) => !task.completed)
            .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    },

    getCompletedTasks: () => {
        return get()
            .tasks.filter((task) => task.completed)
            .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    },

    getTaskDatesInMonth: (year: number, month: number, pendingOnly: boolean = false) => {
        const dates = new Set<number>();
        get().tasks.forEach((task) => {
            const taskDate = new Date(task.deadline);
            if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
                if (!pendingOnly || !task.completed) {
                    dates.add(taskDate.getDate());
                }
            }
        });
        return dates;
    },
}));
