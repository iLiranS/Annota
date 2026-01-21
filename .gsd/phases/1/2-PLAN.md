---
phase: 1
plan: 2
wave: 1
---

# Plan 1.2: Optimize Store Updates

## Objective
Eliminate the "Reload on Write" anti-pattern in `restoreFolder` by using the new Service return values to surgically update the Zustand store.

## Context
- .gsd/SPEC.md (Goal 1: Eliminate initApp reloads)
- stores/notes-store.ts
- lib/services/folders.service.ts

## Tasks

<task type="auto">
  <name>Surgical Store Update</name>
  <files>stores/notes-store.ts</files>
  <action>
    Modify `restoreFolder` action in `useNotesStore`:
    1. Await the result from `FolderService.restore`.
    2. Remove the `get().initApp()` call.
    3. Use `set(state => ...)` to update `state.folders` and `state.notes`:
       - Iterate through returned `folderIds`: Set `isDeleted=false`, `deletedAt=null`, update `parentId` logic (restore to target or original).
       - Iterate through returned `noteIds`: Set `isDeleted=false`, `deletedAt=null`, `originalFolderId=null`.
    4. Ensure strict type safety while mapping over the state arrays.
  </action>
  <verify>
    Manual verification flow:
    1. Delete a folder with subfolders and notes.
    2. Open a performance monitor or add `console.log` in `initApp`.
    3. Restore the folder.
    4. Confirm `initApp` was NOT called.
    5. Confirm UI updates instantly and correctly shows restored items.
  </verify>
  <done>initApp is removed from restoreFolder and UI updates correctly.</done>
</task>

## Success Criteria
- [ ] `initApp` is no longer called in `restoreFolder`.
- [ ] Restoring a folder incorrectly restores it in the UI (no flicker).
