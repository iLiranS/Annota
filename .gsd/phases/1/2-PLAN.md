---
phase: 1
plan: 2
wave: 1
depends_on: []
files_modified:
  - lib/db/repositories/notes.repository.ts
  - lib/db/repositories/folders.repository.ts
  - lib/db/repositories/tasks.repository.ts
  - lib/db/repositories/index.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Repository layer abstracts Drizzle from stores"
    - "All CRUD operations available for notes, folders, tasks"
    - "Note content is loaded separately from metadata"
  artifacts:
    - "lib/db/repositories/*.ts files exist"
    - "Each repository exports typed functions"
---

# Plan 1.2: Create Database Repository Layer

<objective>
Build the repository layer that abstracts database operations from Zustand stores.

Purpose: Clean separation of concerns — stores handle UI state, repositories handle persistence.
Output: Type-safe repository functions for all entities.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- lib/db/schema.ts (created in Plan 1.1)
- lib/db/client.ts (created in Plan 1.1)
- dev-data/data.ts (existing types to match)
</context>

<tasks>

<task type="auto">
  <name>Create notes repository with metadata/content split</name>
  <files>lib/db/repositories/notes.repository.ts</files>
  <action>
    Create notes repository with Drizzle queries:
    
    ```typescript
    import { eq, and, isNull } from 'drizzle-orm';
    import { db, schema } from '../client';
    
    // Types
    export interface NoteMetadata {
      id: string;
      folderId: string | null;
      title: string;
      preview: string;
      createdAt: Date;
      updatedAt: Date;
      isDeleted: boolean;
      deletedAt: Date | null;
      isPinned: boolean;
      isQuickAccess: boolean;
      tags: string[];
      originalFolderId?: string | null;
    }
    ```
    
    **Metadata operations (fast, for lists):**
    - `getNotesInFolder(folderId: string | null): NoteMetadata[]`
      - Uses `db.select().from(schema.noteMetadata).where(...)`
      - Filters by folderId and isDeleted=false
    - `getNoteMetadataById(noteId: string): NoteMetadata | null`
    - `createNoteMetadata(folderId: string | null): NoteMetadata`
      - Generates cuid, inserts metadata AND creates empty content row
    - `updateNoteMetadata(noteId: string, updates: Partial<NoteMetadata>): void`
    - `softDeleteNote(noteId: string): void`
    - `restoreNote(noteId: string, targetFolderId?: string | null): void`
    - `permanentlyDeleteNote(noteId: string): void`
    - `getQuickAccessNotes(): NoteMetadata[]`
    - `getPinnedNotesInFolder(folderId: string): NoteMetadata[]`
    
    **Content operations (lazy loaded):**
    - `getNoteContent(noteId: string): string`
    - `updateNoteContent(noteId: string, content: string, preview: string): void`
      - Updates content table AND preview in metadata
    
    AVOID: Do NOT load content in list queries — this defeats the purpose of the split.
    NOTE: Use synchronous Drizzle API (expo-sqlite is sync).
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit lib/db/repositories/notes.repository.ts</verify>
  <done>Notes repository exports all metadata and content functions with proper types</done>
</task>

<task type="auto">
  <name>Create folders repository</name>
  <files>lib/db/repositories/folders.repository.ts</files>
  <action>
    Create folders repository with functions:
    
    ```typescript
    import { eq, and, isNull } from 'drizzle-orm';
    import { db, schema } from '../client';
    ```
    
    - `getFoldersInFolder(parentId: string | null): Folder[]`
    - `getFolderById(folderId: string): Folder | null`
    - `createFolder(parentId: string | null, name: string, icon?: string): Folder`
    - `updateFolder(folderId: string, updates: Partial<Folder>): void`
    - `softDeleteFolder(folderId: string): void` — cascade to children
    - `restoreFolder(folderId: string, targetParentId?: string | null): void`
    - `permanentlyDeleteFolder(folderId: string): void` — cascade delete
    - `emptyTrash(): void`
    - `getTrashContents(): { folders: Folder[], notes: NoteMetadata[] }`
    
    For cascade operations:
    - Get all descendant folder IDs recursively
    - Update/delete all in a transaction using `db.transaction()`
    
    AVOID: Do NOT allow deletion of system folders (isSystem: true).
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit lib/db/repositories/folders.repository.ts</verify>
  <done>Folders repository exports all CRUD functions with cascade support</done>
</task>

<task type="auto">
  <name>Create tasks repository</name>
  <files>lib/db/repositories/tasks.repository.ts</files>
  <action>
    Create tasks repository with functions:
    
    ```typescript
    import { eq, and, gte, lt, asc } from 'drizzle-orm';
    import { db, schema } from '../client';
    ```
    
    - `getAllTasks(): Task[]`
    - `getTaskById(taskId: string): Task | null`
    - `getTasksByDate(date: Date): Task[]`
      - Filter: deadline >= startOfDay AND deadline < startOfNextDay
    - `getTasksSortedByDeadline(): Task[]`
    - `getPendingTasks(): Task[]`
    - `getCompletedTasks(): Task[]`
    - `createTask(data: CreateTaskInput): Task`
    - `updateTask(taskId: string, updates: Partial<Task>): void`
    - `deleteTask(taskId: string): void`
    - `toggleTaskComplete(taskId: string): void`
    
    Match the existing Task interface from dev-data/data.ts.
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit lib/db/repositories/tasks.repository.ts</verify>
  <done>Tasks repository exports all CRUD and query functions</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] lib/db/repositories/notes.repository.ts exists
- [ ] lib/db/repositories/folders.repository.ts exists
- [ ] lib/db/repositories/tasks.repository.ts exists
- [ ] All files compile without TypeScript errors
- [ ] Note content is loaded via separate function from metadata
</verification>

<success_criteria>
- [ ] Repository layer complete for all entities
- [ ] Metadata/content split enforced in notes repository
- [ ] Cascade operations use transactions
- [ ] All functions are properly typed
</success_criteria>
