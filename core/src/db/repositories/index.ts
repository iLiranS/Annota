// Export all repositories
export * as foldersRepo from './folders.repository';
export * as imagesRepo from './images.repository';
export * as notesRepo from './notes.repository';
export * as tasksRepo from './tasks.repository';

// Re-export commonly used types
export type { Folder } from './folders.repository';
export type { ImageRecord } from './images.repository';
export type { NoteMetadata } from './notes.repository';
export type { CreateTaskInput, Task } from './tasks.repository';

// Re-export system folder IDs
export { DAILY_NOTES_FOLDER_ID, TRASH_FOLDER_ID } from './folders.repository';

