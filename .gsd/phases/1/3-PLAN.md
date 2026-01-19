---
phase: 1
plan: 3
wave: 2
depends_on: ["1.1", "1.2"]
files_modified:
  - stores/notes-store.ts
  - app/_layout.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Notes store reads/writes from SQLite via repository"
    - "Database initializes before app renders"
    - "All existing notes-store functionality preserved"
  artifacts:
    - "stores/notes-store.ts uses repository functions"
    - "app/_layout.tsx calls initDatabase on mount"
---

# Plan 1.3: Migrate Notes Store to SQLite

<objective>
Update the notes Zustand store to use SQLite persistence via the repository layer.

Purpose: Replace in-memory dummy data with persistent database storage.
Output: Fully functional notes-store backed by SQLite.
</objective>

<context>
Load for context:
- stores/notes-store.ts (current implementation)
- lib/db/repositories/notes.repository.ts
- lib/db/repositories/folders.repository.ts
- lib/db/client.ts
- app/_layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Add database initialization to app layout</name>
  <files>app/_layout.tsx</files>
  <action>
    Modify app/_layout.tsx to:
    
    1. Import `initDatabase` from lib/db/client
    2. Add state: `const [dbReady, setDbReady] = useState(false)`
    3. Initialize database synchronously in useEffect:
    ```typescript
    useEffect(() => {
      try {
        initDatabase(); // Drizzle/expo-sqlite is sync
        setDbReady(true);
      } catch (error) {
        console.error('Database init failed:', error);
      }
    }, []);
    ```
    4. Show loading state until dbReady is true
    5. Only render children after database is ready
    
    NOTE: Drizzle with expo-sqlite uses synchronous API, so no await needed.
    AVOID: Do NOT block the splash screen forever — add error handling.
  </action>
  <verify>App launches and shows loading state briefly, then renders</verify>
  <done>Database initializes before app content renders</done>
</task>

<task type="auto">
  <name>Refactor notes-store to use repository</name>
  <files>stores/notes-store.ts</files>
  <action>
    Refactor notes-store.ts to:
    
    1. Remove dummy data imports (DUMMY_NOTES, DUMMY_FOLDERS)
    2. Import repository functions from lib/db/repositories
    3. Change state to use NoteMetadata (not full Note with content):
    
    ```typescript
    import * as notesRepo from '@/lib/db/repositories/notes.repository';
    import * as foldersRepo from '@/lib/db/repositories/folders.repository';
    
    interface NotesState {
      notes: NoteMetadata[]; // Metadata only, no content
      folders: Folder[];
      rootSettings: RootSettings;
      
      // Load data from DB
      loadNotesInFolder: (folderId: string | null) => void;
      loadFoldersInFolder: (parentId: string | null) => void;
      
      // Note operations (sync — Drizzle/expo-sqlite is sync)
      createNote: (folderId: string | null) => NoteMetadata;
      updateNote: (noteId: string, updates: Partial<NoteMetadata>) => void;
      deleteNote: (noteId: string) => void;
      // ... etc
      
      // Content (separate)
      getNoteContent: (noteId: string) => string;
      updateNoteContent: (noteId: string, content: string) => void;
    }
    ```
    
    4. Replace in-memory operations with repository calls:
    - `createNote` → `notesRepo.createNoteMetadata()` then update local state
    - `deleteNote` → `notesRepo.softDeleteNote()` then update local state
    - `getNotesInFolder` → `notesRepo.getNotesInFolder()`
    
    5. Add `getNoteContent(noteId)` that calls `notesRepo.getNoteContent()`
    
    AVOID: Do NOT load all notes globally — load per folder as needed.
    NOTE: Drizzle operations are synchronous, so no async/await needed.
  </action>
  <verify>TypeScript compiles: npx tsc --noEmit stores/notes-store.ts</verify>
  <done>Notes store uses repository, maintains sync API</done>
</task>

<task type="auto">
  <name>Update note editor to lazy-load content</name>
  <files>app/(tabs)/Notes/[id]/index.tsx</files>
  <action>
    Update the note editor screen to:
    
    1. Load note metadata from store (already has ID from route)
    2. Load content separately via `getNoteContent(noteId)`:
    ```typescript
    const { getNoteContent, updateNoteContent, getNoteById } = useNotesStore();
    const note = getNoteById(noteId);
    
    const [content, setContent] = useState<string>('');
    
    useEffect(() => {
      const loadedContent = getNoteContent(noteId);
      setContent(loadedContent);
    }, [noteId]);
    ```
    
    3. Save content changes via `updateNoteContent(noteId, content)`
    4. Generate preview from content (first ~100 chars, strip HTML)
    
    This implements the lazy-loading pattern from SPEC.md.
  </action>
  <verify>Note editor loads and displays content correctly</verify>
  <done>Note content lazy-loads separately from metadata</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] App launches without errors
- [ ] Database initializes on startup
- [ ] Notes list loads from SQLite
- [ ] Creating a note persists to database
- [ ] Note content lazy-loads in editor
</verification>

<success_criteria>
- [ ] Notes store fully migrated to SQLite
- [ ] Database initialized before render
- [ ] Lazy loading implemented for note content
- [ ] Existing UI still works
</success_criteria>
