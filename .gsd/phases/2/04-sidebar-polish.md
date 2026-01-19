---
phase: 2
plan: 4
wave: 1
depends_on: [2.2, 2.3]
files_modified:
  - components/navigation/sidebar.tsx
  - app/(drawer)/Notes/[id]/index.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Sidebar items ordered: Home, Tasks, Quick Access, Daily, All Notes, Folders, Trash"
    - "Settings button present in sidebar footer"
    - "Drawer swipe disabled in Note Editor"
  artifacts:
    - "components/navigation/sidebar.tsx updated"
---

# Plan 2.4: Sidebar Polish & Navigation Fixes

<objective>
Update the Sidebar layout to match user preference and disable drawer swipe gestures within the Note Editor to prevent navigation conflicts.

Purpose: Improve usability and navigation flow.
</objective>

<context>
Load for context:
- components/navigation/sidebar.tsx
- app/(drawer)/Notes/[id]/index.tsx
</context>

<tasks>

<task type="auto">
  <name>Refactor Sidebar Layout</name>
  <files>components/navigation/sidebar.tsx</files>
  <action>
    Update `Sidebar` component:
    1. Reorder Top Section:
       - Home
       - Tasks
       - Quick Access
       - Daily Note
    2. Add Separator (View with borderBottom).
    3. Middle Section:
       - All Notes (navigates to Root Notes)
       - Folders List (Top level only)
    4. Add Separator.
    5. Bottom/Footer Section:
       - Trash
       - Settings (bottom right or bottom row)
    6. Ensure `loadFoldersInFolder(null)` is called to populate folders.
  </action>
  <verify>Visual check (implied)</verify>
  <done>Sidebar layout matches requirements</done>
</task>

<task type="auto">
  <name>Disable Drawer Swipe in Editor</name>
  <files>app/(drawer)/Notes/[id]/index.tsx</files>
  <action>
    In `NoteEditor` component:
    1. Use `useNavigation` and `useFocusEffect`.
    2. Disable drawer swipe when screen is focused:
       `navigation.getParent()?.setOptions({ swipeEnabled: false })`
    3. Re-enable when blurred.
  </action>
  <verify>Code inspection</verify>
  <done>Swipe gesture disabled in editor</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Sidebar order is correct
- [ ] Folders appear in sidebar
- [ ] Drawer doesn't open when swiping in Editor
</verification>

<success_criteria>
- [ ] Sidebar reordered
- [ ] Settings added
- [ ] Editor swipe fixed
</success_criteria>
