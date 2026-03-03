import * as tasksRepo from '../db/repositories/tasks.repository';
import type { Task, TaskInsert } from '../db/schema';
import { generateTask } from '../utils/tasks';



export const TaskService = {
    // Async getters
    getAllTasks: async (): Promise<Task[]> => {
        return await tasksRepo.getAllTasks();
    },

    getTaskById: async (taskId: string): Promise<Task | null> => {
        return await tasksRepo.getTaskById(taskId);
    },

    getTasksByDate: async (date: Date): Promise<Task[]> => {
        return await tasksRepo.getTasksByDate(date);
    },

    getTasksSortedByDeadline: async (): Promise<Task[]> => {
        return await tasksRepo.getTasksSortedByDeadline();
    },

    getPendingTasks: async (): Promise<Task[]> => {
        return await tasksRepo.getPendingTasks();
    },

    getCompletedTasks: async (): Promise<Task[]> => {
        return await tasksRepo.getCompletedTasks();
    },

    getTaskDatesInMonth: async (year: number, month: number): Promise<Set<number>> => {
        return await tasksRepo.getTaskDatesInMonth(year, month);
    },

    create: async (data: Partial<TaskInsert>): Promise<Task> => {
        const task = generateTask(data);
        return await tasksRepo.createTask(task);
    },

    update: async (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> => {
        await tasksRepo.updateTask(taskId, updates);
    },

    delete: async (taskId: string): Promise<void> => {
        await tasksRepo.deleteTask(taskId);
    },

    toggleComplete: async (taskId: string): Promise<void> => {
        await tasksRepo.toggleTaskComplete(taskId);
    },

    clearCompleted: async (): Promise<void> => {
        await tasksRepo.deleteCompletedTasks();
    },

    clearCompletedSince: async (date: Date): Promise<void> => {
        await tasksRepo.clearCompletedSince(date);
    },

    // Obsolete sync wrappers deleted
};
