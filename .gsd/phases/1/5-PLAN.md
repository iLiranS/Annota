---
phase: 1
plan: 5
wave: 3
depends_on: ["1.3", "1.4"]
files_modified:
  - lib/db/seed.ts
  - lib/db/client.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "App runs with empty database on fresh install"
    - "System folders (Trash, Daily Notes) are auto-created"
    - "Data persists across app restart"
  artifacts:
    - "lib/db/seed.ts creates initial system data"
---

# Plan 1.5: Seed Data & Integration Testing

<objective>
Create seed data for fresh installs and verify the complete database integration.

Purpose: Ensure the app works correctly from a fresh state and data persists.
Output: Working app with persistent SQLite database.
</objective>

<context>
Load for context:
- lib/db/client.ts
- lib/db/schema.ts
- lib/db/repositories/*.ts
- stores/notes-store.ts
- stores/tasks-store.ts
</context>

<tasks>

<task type="auto">
  <name>Create seed function for system data</name>
  <files>lib/db/seed.ts</files>
  <action>
    Create lib/db/seed.ts with:
    
    ```typescript
    import { db, schema } from './client';
    import { eq } from 'drizzle-orm';
    
    export const TRASH_FOLDER_ID = 'system-trash';
    export const DAILY_NOTES_FOLDER_ID = 'system-daily-notes';
    
    export function seedSystemData(): void {
      const now = new Date();
      
      // Create Trash folder if not exists
      const existingTrash = db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, TRASH_FOLDER_ID))
        .get();
      
      if (!existingTrash) {
        db.insert(schema.folders).values({
          id: TRASH_FOLDER_ID,
          name: 'Trash',
          icon: 'trash',
          parentId: null,
          isSystem: true,
          isDeleted: false,
          sortType: 'UPDATED_LAST',
          createdAt: now,
          updatedAt: now,
        }).run();
      }
      
      // Create Daily Notes folder if not exists
      const existingDaily = db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.id, DAILY_NOTES_FOLDER_ID))
        .get();
      
      if (!existingDaily) {
        db.insert(schema.folders).values({
          id: DAILY_NOTES_FOLDER_ID,
          name: 'Daily Notes',
          icon: 'calendar',
          parentId: null,
          isSystem: true,
          isDeleted: false,
          sortType: 'UPDATED_LAST',
          createdAt: now,
          updatedAt: now,
        }).run();
      }
      
      // Initialize default settings if not exist
      const existingTypography = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, 'typography'))
        .get();
      
      if (!existingTypography) {
        db.insert(schema.settings).values({
          key: 'typography',
          value: JSON.stringify({
            fontFamily: 'System',
            fontSize: 16,
            lineHeight: 1.5,
          }),
        }).run();
      }
      
      console.log('System data seeded');
    }
    ```
    
    AVOID: Do NOT include test/demo data — only system-required entries.
  </action>
  <verify>Function runs without error when called</verify>
  <done>Seed function creates Trash and Daily Notes folders</done>
</task>

<task type="auto">
  <name>Integrate seed into database initialization</name>
  <files>lib/db/client.ts</files>
  <action>
    Update initDatabase() to call seed after table creation:
    
    ```typescript
    import { seedSystemData } from './seed';
    
    export function initDatabase(): void {
      try {
        // Create tables (existing code)
        expoDb.execSync(`...`);
        
        // Seed system data
        seedSystemData();
        
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
      }
    }
    ```
  </action>
  <verify>App launches, database initializes, Trash folder exists</verify>
  <done>Database setup includes seeding on first run</done>
</task>

<task type="checkpoint:human-verify">
  <name>Full integration verification</name>
  <files>N/A</files>
  <action>
    Manually test the complete flow:
    
    1. **Fresh install:**
       - Delete app data / reinstall
       - Launch app
       - Verify Trash and Daily Notes folders exist in sidebar (Phase 2 will add sidebar, for now check via DB or logs)
    
    2. **Notes:**
       - Create a new note in root
       - Add content and title
       - Force close app (swipe away)
       - Reopen app
       - Verify note persists with content
    
    3. **Folders:**
       - Create a folder
       - Create a note inside folder
       - Force close and reopen app
       - Verify folder and note persist
    
    4. **Tasks:**
       - Create a task with deadline
       - Complete the task
       - Force close and reopen app
       - Verify task state persists
    
    5. **Trash:**
       - Delete a note
       - Verify it moves to Trash folder
       - Force close and reopen app
       - Verify deleted note still in Trash
  </action>
  <verify>User confirms all persistence tests pass</verify>
  <done>Full integration verified — data persists across app restart</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Fresh install creates system folders
- [ ] Notes persist across app restart
- [ ] Folders persist across app restart
- [ ] Tasks persist across app restart
- [ ] Trash functionality works with persistence
</verification>

<success_criteria>
- [ ] App works on fresh install
- [ ] System data seeds correctly
- [ ] All data types persist
- [ ] Phase 1 exit criteria met
</success_criteria>
