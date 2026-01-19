---
phase: 1
plan: 4
wave: 2
depends_on: ["1.1", "1.2"]
files_modified:
  - stores/tasks-store.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Tasks store reads/writes from SQLite via repository"
    - "All existing tasks-store functionality preserved"
    - "Calendar integration still works"
  artifacts:
    - "stores/tasks-store.ts uses repository functions"
---

# Plan 1.4: Migrate Tasks Store to SQLite

<objective>
Update the tasks Zustand store to use SQLite persistence via the repository layer.

Purpose: Complete the database migration for all app data.
Output: Fully functional tasks-store backed by SQLite.
</objective>

<context>
Load for context:
- stores/tasks-store.ts (current implementation)
- lib/db/repositories/tasks.repository.ts
- lib/db/client.ts
</context>

<tasks>

<task type="auto">
  <name>Refactor tasks-store to use repository</name>
  <files>stores/tasks-store.ts</files>
  <action>
    Refactor tasks-store.ts to:
    
    1. Remove dummy data import (DUMMY_TASKS)
    2. Import repository: `import * as tasksRepo from '@/lib/db/repositories/tasks.repository'`
    3. Load tasks from DB on initialization:
    
    ```typescript
    interface TasksState {
      tasks: Task[];
      
      // Load from DB
      loadTasks: () => void;
      
      // CRUD (sync — calls repo then updates local state)
      createTask: (data: CreateTaskInput) => Task;
      updateTask: (taskId: string, updates: Partial<Task>) => void;
      deleteTask: (taskId: string) => void;
      toggleComplete: (taskId: string) => void;
      
      // Getters (operate on local state)
      getTaskById: (taskId: string) => Task | undefined;
      getTasksByDate: (date: Date) => Task[];
      getTasksSortedByDeadline: () => Task[];
      getPendingTasks: () => Task[];
      getCompletedTasks: () => Task[];
    }
    ```
    
    4. `loadTasks()` fetches all tasks from DB and sets local state
    5. Mutations call repository then update local state:
    ```typescript
    createTask: (data) => {
      const task = tasksRepo.createTask(data);
      set((state) => ({ tasks: [...state.tasks, task] }));
      return task;
    }
    ```
    
    NOTE: Drizzle operations are synchronous, so no async/await needed.
    AVOID: Do NOT change getter signatures — keep getters as-is for UI compatibility.
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit stores/tasks-store.ts</verify>
  <done>Tasks store uses repository, sync API preserved</done>
</task>

<task type="auto">
  <name>Update Home screen to load tasks</name>
  <files>app/(tabs)/index.tsx</files>
  <action>
    Update Home screen to:
    
    1. Call `loadTasks()` on mount:
    ```typescript
    const { tasks, loadTasks } = useTasksStore();
    
    useEffect(() => {
      loadTasks();
    }, []);
    ```
    
    2. Rest of the component remains unchanged (uses getters)
    
    This ensures tasks are loaded from DB when Home screen mounts.
  </action>
  <verify>Home screen loads and displays tasks from database</verify>
  <done>Tasks load from database on Home screen mount</done>
</task>

<task type="auto">
  <name>Update Tasks tab to load tasks</name>
  <files>app/(tabs)/Tasks/index.tsx</files>
  <action>
    Update Tasks tab to:
    
    1. Call `loadTasks()` on mount if needed
    2. Task CRUD operations already work via store (which calls repo)
    3. List should refresh automatically via Zustand subscription
    
    Ensure task list stays in sync after create/update/delete.
  </action>
  <verify>Tasks tab loads and CRUD operations work</verify>
  <done>Tasks tab fully functional with SQLite backend</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Tasks load from database on app start
- [ ] Creating a task persists to database
- [ ] Completing a task persists
- [ ] Deleting a task removes from database
- [ ] Calendar shows correct task indicators
</verification>

<success_criteria>
- [ ] Tasks store fully migrated to SQLite
- [ ] Home and Tasks screens load data from DB
- [ ] All CRUD operations persist
- [ ] Calendar integration works
</success_criteria>
