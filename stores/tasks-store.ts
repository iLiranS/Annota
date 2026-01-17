import { DUMMY_TASKS, Task } from '@/dev-data/data';
import { create } from 'zustand';

// Generate unique IDs
function generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface TasksState {
    // Data
    tasks: Task[];

    // Task operations
    createTask: (data: Pick<Task, 'title' | 'description' | 'deadline' | 'linkedNoteId'>) => Task;
    updateTask: (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
    deleteTask: (taskId: string) => void;
    toggleComplete: (taskId: string) => void;

    // Getters
    getTaskById: (taskId: string) => Task | undefined;
    getTasksByDate: (date: Date) => Task[];
    getTasksSortedByDeadline: () => Task[];
    getPendingTasks: () => Task[];
    getCompletedTasks: () => Task[];
}

export const useTasksStore = create<TasksState>((set, get) => ({
    // Initial data from dummy data
    tasks: [...DUMMY_TASKS],

    // Task operations
    createTask: (data) => {
        const now = new Date();
        const newTask: Task = {
            id: generateId(),
            title: data.title || 'Untitled Task',
            description: data.description || '',
            deadline: data.deadline,
            completed: false,
            linkedNoteId: data.linkedNoteId || null,
            createdAt: now,
        };
        set((state) => ({
            tasks: [...state.tasks, newTask],
        }));
        return newTask;
    },

    updateTask: (taskId: string, updates) => {
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === taskId ? { ...task, ...updates } : task
            ),
        }));
    },

    deleteTask: (taskId: string) => {
        set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId),
        }));
    },

    toggleComplete: (taskId: string) => {
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
            ),
        }));
    },

    // Getters
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
}));
