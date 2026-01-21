---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Fix Core Data Logic

## Objective
Fix the "Invisible Child" bug where deleted sub-folders are ignored during restoration, and update the Service layer to return affected IDs for optimistic UI updates.

## Context
- .gsd/SPEC.md (Goals 1 & 2)
- lib/db/repositories/folders.repository.ts
- lib/services/folders.service.ts
- lib/db/repositories/notes.repository.ts

## Tasks

<task type="auto">
  <name>Fix Recursive Folder Fetching</name>
  <files>lib/db/repositories/folders.repository.ts</files>
  <action>
    Modify `getAllDescendantFolderIds` to accept an `includeDeleted` boolean parameter (default false).
    - When `includeDeleted` is true, remove the `eq(schema.folders.isDeleted, false)` filter from the query.
    - Ensure recursive calls pass this parameter down.
    - Update the function signature: `getAllDescendantFolderIds(folderId: string, includeDeleted: boolean = false): string[]`
  </action>
  <verify>
    Create and run a script `scripts/verify-repo.ts` that:
    1. Creates a parent folder P and child C.
    2. Soft deletes P (which cascades to C).
    3. Calls `getAllDescendantFolderIds(P.id, true)` and asserts it returns C.id.
  </verify>
  <done>Function returns deleted descendants when flag is true.</done>
</task>

<task type="auto">
  <name>Update Service Return Signature</name>
  <files>lib/services/folders.service.ts</files>
  <action>
    Refactor `FolderService.restore`:
    1. Call `foldersRepo.getAllDescendantFolderIds(folderId, true)` to ensure we get ALL descendants even if they are currently deleted.
    2. Capture the `allDescendantIds`.
    3. Calculate `affectedNoteIds` (using `getNoteIdsInFolders` logic or assuming all notes in these folders need restoration). *Note: notesRepo might need a `getNoteIdsInFolders` if not exists.*
    4. Return `{ folderIds: string[], noteIds: string[] }` instead of `void`.
    5. Ensure the transaction logic still performs the updates correctly.
  </action>
  <verify>
    Update the `scripts/verify-repo.ts` (or create `scripts/verify-service.ts`) to:
    1. Setup a deleted folder tree with notes.
    2. Call `FolderService.restore`.
    3. Log the return value and confirm it contains the expected IDs.
  </verify>
  <done>Service method returns object with restored IDs.</done>
</task>

## Success Criteria
- [ ] `getAllDescendantFolderIds` works for deleted trees.
- [ ] `FolderService.restore` returns data needed for optimistic updates.
