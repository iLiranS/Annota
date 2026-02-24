import type { Task, TaskInsert } from '@/lib/db/schema';
import { TaskService } from '@/lib/services/tasks.service';
import { SyncScheduler } from '@/lib/sync/sync-scheduler';
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
            tasks: state.tasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
            ),
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
            tasks: state.tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
            ),
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
