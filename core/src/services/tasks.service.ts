import * as tasksRepo from '../db/repositories/tasks.repository';
import type { Task, TaskInsert } from '../db/schema';
import { generateTask } from '../utils/tasks';



export const TaskService = {
    // 0. Getters
    getAllTasks: (): Task[] => {
        return tasksRepo.getAllTasks();
    },

    getTaskById: (taskId: string): Task | null => {
        return tasksRepo.getTaskById(taskId);
    },

    getTasksByDate: (date: Date): Task[] => {
        return tasksRepo.getTasksByDate(date);
    },

    getTasksSortedByDeadline: (): Task[] => {
        return tasksRepo.getTasksSortedByDeadline();
    },

    getPendingTasks: (): Task[] => {
        return tasksRepo.getPendingTasks();
    },

    getCompletedTasks: (): Task[] => {
        return tasksRepo.getCompletedTasks();
    },

    getTaskDatesInMonth: (year: number, month: number): Set<number> => {
        return tasksRepo.getTaskDatesInMonth(year, month);
    },

    // 1. Create
    create: (data: Partial<TaskInsert>): Task => {
        const task = generateTask(data);
        return tasksRepo.createTask(task);
    },

    // 2. Update
    update: (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
        tasksRepo.updateTask(taskId, updates);
    },

    // 3. Delete
    delete: (taskId: string) => {
        tasksRepo.deleteTask(taskId);
    },

    // 4. Toggle Complete
    toggleComplete: (taskId: string) => {
        tasksRepo.toggleTaskComplete(taskId);
    },

    // 5. Clear Completed
    clearCompleted: () => {
        tasksRepo.deleteCompletedTasks();
    },

    clearCompletedSince: (date: Date) => {
        tasksRepo.clearCompletedSince(date);
    },
};
