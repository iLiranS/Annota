---
phase: 2
plan: 3
wave: 3
depends_on: [2.1]
files_modified:
  - app/(drawer)/notes/_layout.tsx
  - app/(drawer)/notes/index.tsx
  - app/(drawer)/notes/[id].tsx
  - app/(drawer)/notes/[id]/index.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Notes section uses Stack navigation"
    - "Can push multiple folder layers"
    - "Header shows Menu at root, Back at child"
    - "Swipe to open sidebar works only on folder screens"
  artifacts:
    - "app/(drawer)/notes/_layout.tsx exists"
---

# Plan 2.3: Folder Stack Navigation

<objective>
Implement the stack-based folder navigation within the 'Notes' drawer route.
This enables deep nesting of folders while keeping the Sidebar accessible.

Purpose: Allow hierarchical navigation of folders as per SPEC.
Output: A Stack navigator for notes/folders with proper header logic.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- app/(drawer)/notes/index.tsx
- components/navigation/sidebar.tsx (reference for navigation actions)
</context>

<tasks>

<task type="auto">
  <name>Configure Notes Stack</name>
  <files>
    app/(drawer)/notes/_layout.tsx
    app/(drawer)/notes/index.tsx
  </files>
  <action>
    1. Create `app/(drawer)/notes/_layout.tsx` as a `Stack`.
    2. Configure `app/(drawer)/notes/index.tsx` as the "Root Folder" screen.
    3. Ensure `headerLeft` shows a "Menu" icon that calls `navigation.openDrawer()`.
  </action>
  <verify>Navigation to Notes shows stack header with menu</verify>
  <done>Root stack configured</done>
</task>

<task type="auto">
  <name>Implement Nested Folder Routing</name>
  <files>
    app/(drawer)/notes/[folderId].tsx (or move existing [id])
    app/(drawer)/notes/folder/[id].tsx
  </files>
  <action>
    Refactor file structure to support:
    - `notes/index` (Root)
    - `notes/folder/[id]` (Nested folder)
    - `notes/note/[id]` (Note Editor) -> Wait, currently `notes/[id]`.
    
    Clarify structure:
    - `notes/index.tsx` -> List of notes/folders in ROOT.
    - `notes/[id]/index.tsx` -> Note Editor.
    - We need `notes/folder/[id].tsx` for displaying a FOLDER.
    
    Action:
    1. Create `app/(drawer)/notes/folder/[id].tsx`. it should reuse the `FolderList` logic from `index.tsx` (maybe extract `FolderList` component).
    2. Update `FolderItem` onPress to push `/notes/folder/[id]`.
    3. Ensure `notes/folder/[id]` header has BACK button (standard Stack behavior).
  </action>
  <verify>Clicking a folder pushes new screen</verify>
  <done>Recursive folder navigation works</done>
</task>

<task type="auto">
  <name>Gestures & Polish</name>
  <files>
    app/(drawer)/notes/_layout.tsx
  </files>
  <action>
    1. Enable `gestureEnabled: true` for Stack.
    2. Ensure "Left Edge Swipe" to open drawer is enabled on Folder screens (`notes/index` and `notes/folder/[id]`).
       - *Note: In a nested Stack inside Drawer, standard edge swipe pops stack. Opening drawer usually requires a customized gesture or button.*
       - SPEC says: "Folder screens: Left edge swipe → open sidebar".
       - If confusing with "Back", prefer Menu button or specific gesture config.
       - Configure `screenOptions`.
    3. Ensure Note Editor (`notes/[id]`) DISABLES drawer swipe.
  </action>
  <verify>Swipe works on lists, disabled on editor</verify>
  <done>Gestures configured</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Root folder shows Menu icon
- [ ] Child folder shows Back icon
- [ ] Back button pops folder stack (up one level)
- [ ] Note editor pushes on top of stack
</verification>

<success_criteria>
- [ ] Stack navigation implemented
- [ ] Nested folders working
- [ ] Header logic correct
</success_criteria>
