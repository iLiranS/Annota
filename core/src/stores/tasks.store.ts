import type { Task, TaskInsert } from '../db/schema';
import { TaskService } from '../services/tasks.service';
import { SyncScheduler } from '../sync/sync-scheduler';
import { create } from 'zustand';

// Re-export types
export type { Task, TaskInsert };

interface TasksState {
    // Data (cached from DB)
    tasks: Task[];

    // Load from DB
    loadTasks: () => void;

    // Task operations
    createTask: (data: Partial<TaskInsert>) => Task;
    updateTask: (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
    deleteTask: (taskId: string) => void;
    toggleComplete: (taskId: string) => void;
    clearCompletedTasks: () => void;
    clearOldCompletedTasks: (date: Date) => void;

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
    loadTasks: () => {
        const tasks = TaskService.getAllTasks();
        set({ tasks });
    },

    // Task operations
    createTask: (data) => {
        // Service handles ID generation and DB insertion
        const task = TaskService.create(data);
        set((state) => ({
            tasks: [...state.tasks, task],
        }));
        SyncScheduler.instance?.notifyContentChange();
        return task;
    },

    updateTask: (taskId: string, updates) => {
        TaskService.update(taskId, updates);
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

    deleteTask: (taskId: string) => {
        TaskService.delete(taskId);
        set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId),
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    toggleComplete: (taskId: string) => {
        TaskService.toggleComplete(taskId);
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

    clearCompletedTasks: () => {
        TaskService.clearCompleted();
        set((state) => ({
            tasks: state.tasks.filter((task) => !task.completed),
        }));
        SyncScheduler.instance?.notifyContentChange();
    },

    clearOldCompletedTasks: (date: Date) => {
        set((state) => {
            let clearedCount = 0;
            const newTasks = state.tasks.filter((task) => {
                let keep = true;
                if (task.completed && task.completedAt && task.completedAt < date) {
                    keep = false;
                    clearedCount++;
                }
                return keep;
            });

            if (clearedCount > 0) {
                console.log(`[DAILY_CLEANUP] Cleared ${clearedCount} old completed tasks.`);
                TaskService.clearCompletedSince(date);
            }

            return { tasks: newTasks };
        });
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
