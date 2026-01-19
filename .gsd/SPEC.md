# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Milestone**: 1.0 — Frontend + Local Database
> **Created**: 2026-01-19

## Vision

A privacy-first, local-first notes app for iOS and Android. All data lives in SQLite on-device, serving as the single source of truth for the UI. The app prioritizes deep folder navigation, quick access to frequently-used notes, and a rich editing experience with version history. Future milestones will add E2E encrypted cloud sync and collaboration.

## Goals

1. **Navigation Overhaul** — Replace bottom tabs with a slide-in sidebar and stack-based folder navigation
2. **Data Architecture** — Split notes into Metadata and Content tables for efficient lazy-loading
3. **Local Database** — Implement SQLite as the authoritative local data store
4. **Rich Features** — Deliver a complete notes experience with tags, links, version history, daily notes, and export
5. **Task Integration** — Maintain Tasks as a separate module accessible from sidebar

## Non-Goals (Out of Scope for Milestone 1)

- Backend API or cloud infrastructure
- E2E encryption implementation
- Note sharing or collaboration
- Web application
- Actual backup functionality (UI shell only)
- Offline sync conflict resolution

## Users

**Primary:** Individual users who want a powerful, private notes app on their phone
**Use cases:**
- Daily journaling with auto-created daily notes
- Organizing work/personal notes in nested folders
- Quick capture with global quick access
- Referencing version history of important notes
- Exporting notes for sharing or archival

## Architecture

### Database Schema (SQLite)

```
┌─────────────────────────────────────────────────────────────┐
│                        LOCAL SQLITE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  note_metadata                    note_content               │
│  ┌──────────────────────┐        ┌──────────────────────┐   │
│  │ id (PK)              │        │ noteId (PK, FK)      │   │
│  │ folderId (FK)        │───────▶│ content (TEXT)       │   │
│  │ title                │        └──────────────────────┘   │
│  │ preview              │                                    │
│  │ updatedAt            │        note_versions               │
│  │ createdAt            │        ┌──────────────────────┐   │
│  │ isDeleted            │        │ id (PK)              │   │
│  │ deletedAt            │        │ noteId (FK)          │   │
│  │ isPinned             │        │ content (TEXT)       │   │
│  │ isQuickAccess        │        │ createdAt            │   │
│  │ tags (JSON)          │        └──────────────────────┘   │
│  └──────────────────────┘                                    │
│                                                              │
│  folders                          tasks                      │
│  ┌──────────────────────┐        ┌──────────────────────┐   │
│  │ id (PK)              │        │ id (PK)              │   │
│  │ parentId (FK, self)  │        │ title                │   │
│  │ name                 │        │ description          │   │
│  │ icon                 │        │ deadline             │   │
│  │ sortType             │        │ completed            │   │
│  │ isSystem             │        │ linkedNoteId (FK)    │   │
│  │ isDeleted            │        │ createdAt            │   │
│  │ deletedAt            │        └──────────────────────┘   │
│  │ createdAt            │                                    │
│  │ updatedAt            │        settings                    │
│  └──────────────────────┘        ┌──────────────────────┐   │
│                                   │ key (PK)             │   │
│  tags                             │ value (JSON)         │   │
│  ┌──────────────────────┐        └──────────────────────┘   │
│  │ id (PK)              │                                    │
│  │ name                 │                                    │
│  │ color                │                                    │
│  └──────────────────────┘                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Navigation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ROOT NAVIGATOR                          │
│                                                              │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │   SIDEBAR   │◀──▶│           MAIN STACK                │ │
│  │  (Drawer)   │    │                                     │ │
│  │             │    │  ┌─────────────────────────────┐   │ │
│  │ • Daily     │    │  │      Folder Screen          │   │ │
│  │ • Unfoldered│    │  │   (root or nested folder)   │   │ │
│  │ • Quick     │    │  └──────────────┬──────────────┘   │ │
│  │   Access    │    │                 │ push              │ │
│  │ • Folders   │    │  ┌──────────────▼──────────────┐   │ │
│  │   └─ Work   │    │  │      Folder Screen          │   │ │
│  │   └─ Personal    │  │    (child folder)           │   │ │
│  │ • Tasks     │    │  └──────────────┬──────────────┘   │ │
│  │ • Trash     │    │                 │ push              │ │
│  │             │    │  ┌──────────────▼──────────────┐   │ │
│  └─────────────┘    │  │      Note Editor            │   │ │
│                     │  │   (full screen)             │   │ │
│                     │  └─────────────────────────────┘   │ │
│                     └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Gesture behavior:
• Folder screens: Left edge swipe → open sidebar
• Note editor: Left edge swipe → disabled (editor focus)
• Back button: Pop stack (or menu icon at root)
```

## Feature Specifications

### 1. Sidebar Navigation
- **Sections:** Daily Note, Unfoldered (root), Quick Access, Folders (tree), Tasks, Trash
- **Behavior:** Slide in from left edge, slide out to hide
- **Folders:** Show top-level folders, tap to navigate (not expand in sidebar)
- **Always slide-in:** Even on tablets, no persistent sidebar

### 2. Stack-Based Folder Navigation  
- Each folder tap pushes onto navigation stack
- Nested folders continue stacking
- Header: Back button (if nested) or Menu icon (if root)
- Left edge swipe opens sidebar (from folder screens only)

### 3. Daily Notes
- **Location:** Special system folder "Daily Notes"
- **Auto-create:** Tapping "Daily" in sidebar creates/opens today's note
- **Naming:** Note title = date (e.g., "2026-01-19")
- **Calendar:** Shows dots for days with daily notes (alongside task dots)

### 4. Quick Access (Global)
- User marks notes as "Quick Access"
- Appear in sidebar Quick Access section
- Accessible from anywhere, regardless of folder location

### 5. Pinned Notes (Per-Folder)
- User pins notes within a folder
- Pinned notes appear at top of that folder's list
- Pin state is folder-specific (same note pinned in one folder, not another — N/A since notes are in one folder)

### 6. Tags System
- Create/manage tags (name + color)
- Assign multiple tags to a note
- Filter by tag (future: tag view in sidebar)

### 7. Links to Other Notes
- In editor, insert link to another note (`[[Note Title]]` syntax or picker)
- Tapping link navigates to that note
- Backlinks view (future enhancement)

### 8. Collapsible Sections
- In editor, create collapsible/expandable sections
- Useful for organizing long notes
- Persisted in content

### 9. Version History
- **Storage:** Local SQLite `note_versions` table
- **Trigger:** Save version on significant changes (debounced)
- **UI:** View history, preview versions, restore
- **Limit:** Keep last N versions per note (configurable)

### 10. Note Info
- Word count
- Character count
- Created/updated timestamps
- Folder location

### 11. Export
- **Formats:** PDF, HTML, Markdown
- **Method:** Share sheet / save to files
- **Scope:** Single note export

### 12. Typography Settings
- Font family selection
- Font size adjustment
- Line height/spacing
- Persisted in settings table

### 13. Backups (UI Shell)
- Settings screen shows backup options
- "Create Backup" / "Restore Backup" buttons
- Non-functional in Milestone 1 (shows "Coming soon")

### 14. Phone Rotation
- All screens responsive to orientation
- Editor adapts gracefully
- Sidebar closes on rotation (if open)

### 15. Tasks
- Separate SQLite table
- Accessible from sidebar
- Calendar shows task dots
- Edit task modal
- Link task to note (optional)

## Constraints

- **Platform:** iOS and Android via React Native / Expo
- **Database:** SQLite (expo-sqlite or similar)
- **Local-only:** No network calls in Milestone 1
- **Existing codebase:** Refactor from current tab-based structure

## Success Criteria

- [ ] Bottom tabs removed, sidebar navigation fully functional
- [ ] Folder navigation works as nested stack
- [ ] SQLite database stores all notes, folders, tasks
- [ ] Daily Notes auto-create and appear in calendar
- [ ] Quick Access and Pinned notes working
- [ ] Tags can be created, assigned, and filtered
- [ ] Note links navigate correctly
- [ ] Collapsible sections in editor
- [ ] Version history saves and restores
- [ ] Word/character count displays
- [ ] Export to PDF/HTML/MD works
- [ ] Typography settings persist
- [ ] Rotation works on all screens
- [ ] Tasks accessible from sidebar with full CRUD
