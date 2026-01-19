---
phase: 2
plan: 1
wave: 1
depends_on: []
files_modified:
  - package.json
  - app/_layout.tsx
  - app/(drawer)/_layout.tsx
  - app/(drawer)/index.tsx
  - app/(tabs)
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Drawer navigation is active"
    - "Bottom tabs are removed"
    - "App launches into drawer context"
  artifacts:
    - "app/(drawer)/_layout.tsx exists"
    - "@react-navigation/drawer installed"
---

# Plan 2.1: Navigation Infrastructure

<objective>
Install Drawer dependencies and migrate the app structure from Tabs to Drawer.
This establishes the foundation for Phase 2.

Purpose: Replace bottom tabs with sidebar navigation as per SPEC.
Output: Working Drawer navigator (default look) wrapping existing screens.
</objective>

<context>
Load for context:
- .gsd/SPEC.md
- app/_layout.tsx
- app/(tabs)/_layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Install Drawer Dependencies</name>
  <files>package.json</files>
  <action>
    Install required libraries for drawer navigation:
    `npx expo install @react-navigation/drawer react-native-gesture-handler react-native-reanimated`
  </action>
  <verify>grep "@react-navigation/drawer" package.json</verify>
  <done>Dependencies present in package.json</done>
</task>

<task type="auto">
  <name>Migrate directory structure</name>
  <files>
    app/(tabs)
    app/(drawer)
  </files>
  <action>
    1. Rename `app/(tabs)` to `app/(drawer)`.
    2. Be careful to check if git command needed or fs move.
    3. Ensure `app/_layout.tsx` 'unstable_settings' logic is updated or removed (anchor: drawer).
  </action>
  <verify>ls app/(drawer)</verify>
  <done>Directory renamed</done>
</task>

<task type="auto">
  <name>Configure Drawer Layout</name>
  <files>
    app/(drawer)/_layout.tsx
    app/_layout.tsx
  </files>
  <action>
    1. Modify `app/(drawer)/_layout.tsx` to use `Drawer` from `expo-router/drawer`.
    2. Remove `Tabs` logic.
    3. Configure basic screens: `Notes` (label: Notes), `Tasks` (label: Tasks).
    4. Update `app/_layout.tsx` to point to `(drawer)` instead of `(tabs)`.
  </action>
  <verify>pnpm expo start --clear (check for errors)</verify>
  <done>App builds and shows Drawer instead of Tabs</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] App launches without error
- [ ] Swiping right opens a drawer (default UI)
- [ ] Bottom tabs are gone
- [ ] Navigation components refer to (drawer) not (tabs)
</verification>

<success_criteria>
- [ ] Dependencies installed
- [ ] Files moved cleanly
- [ ] Drawer Navigator functioning
</success_criteria>
