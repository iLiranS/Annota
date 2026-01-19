---
phase: 2
plan: 2
wave: 2
depends_on: [2.1]
files_modified:
  - components/navigation/sidebar.tsx
  - app/(drawer)/_layout.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Custom sidebar Component is visible"
    - "Sidebar lists: Daily, Unfoldered, Quick Access, Folders, Tasks, Trash"
    - "Clicking Items navigates correctly"
  artifacts:
    - "components/navigation/sidebar.tsx exists"
---

# Plan 2.2: Custom Sidebar Implementation

<objective>
Build the custom Sidebar component according to design specs and integrate it into the Drawer.

Purpose: Provide the main navigation hub for the user.
Output: A styled sidebar with all required sections and navigation logic.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- app/(drawer)/_layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Create Sidebar Component</name>
  <files>components/navigation/sidebar.tsx</files>
  <action>
    Create a new component `Sidebar` that implements `DrawerContentComponentProps`.
    
    Structure:
    - Header (App Title/User)
    - Section: "Daily Note" (Icon + Text)
    - Section: "Unfoldered" (Icon + Text) - Navigates to Root Notes
    - Section: "Quick Access" (Icon + Text) - Navigates to Quick Access filter (future placeholder)
    - Section: "Folders" (List) - Lists top-level folders (dummy data for now or fetch from store)
    - Section: "Tasks" (Icon + Text)
    - Section: "Trash" (Icon + Text)
    
    Style: Use existing theme tokens.
    Interaction: `onPress` -> `props.navigation.navigate(...)`.
  </action>
  <verify>Component file exists and builds</verify>
  <done>Sidebar component created</done>
</task>

<task type="auto">
  <name>Integrate Sidebar</name>
  <files>app/(drawer)/_layout.tsx</files>
  <action>
    Update `app/(drawer)/_layout.tsx` to use `drawerContent={(props) => <Sidebar {...props} />}`.
    Hide the default header in screens if custom headers are planned, or customize default header.
  </action>
  <verify>Browser Check: Sidebar looks custom</verify>
  <done>Custom sidebar renders in app</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Sidebar matches design list
- [ ] Navigation works (even if screens are same for now)
- [ ] "Daily Note" button is present
</verification>

<success_criteria>
- [ ] Sidebar implemented
- [ ] Integrated into Drawer
- [ ] Navigation wired up
</success_criteria>
