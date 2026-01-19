# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: 1.0 — Frontend + Local Database

## Must-Haves (from SPEC)

- [ ] Sidebar navigation (replaces bottom tabs)
- [ ] Stack-based folder navigation
- [ ] SQLite local database
- [ ] Data split (Metadata + Content)
- [ ] Daily Notes with calendar integration
- [ ] Quick Access + Pinned notes
- [ ] Tags system
- [ ] Note links
- [ ] Collapsible sections
- [ ] Version history (local)
- [ ] Note info (word/char count)
- [ ] Export (PDF/HTML/MD)
- [ ] Typography settings
- [ ] Phone rotation responsive
- [ ] Tasks in sidebar

---

## Phases

### Phase 1: Foundation — Database & Data Architecture
**Status**: ⬜ Not Started
**Objective**: Set up SQLite and migrate from in-memory dummy data to persistent local storage

**Deliverables:**
- SQLite database setup (expo-sqlite or drizzle-orm)
- Schema: `note_metadata`, `note_content`, `note_versions`, `folders`, `tasks`, `tags`, `settings`
- Migration of existing dummy data types to new schema
- Database service layer with CRUD operations
- Zustand stores updated to use SQLite

**Exit Criteria:**
- App launches with SQLite database
- Notes/folders/tasks persist across app restart
- All existing functionality still works

---

### Phase 2: Navigation — Sidebar & Stack Architecture
**Status**: ⬜ Not Started
**Objective**: Replace bottom tabs with drawer sidebar and implement stack-based folder navigation

**Deliverables:**
- Remove bottom tab navigator
- Implement drawer navigator for sidebar
- Sidebar component with sections (Daily, Unfoldered, Quick Access, Folders, Tasks, Trash)
- Stack navigator for folder drill-down
- Header logic (menu icon at root, back button when nested)
- Left edge swipe gesture to open sidebar (folder screens)
- Disable sidebar swipe from note editor

**Exit Criteria:**
- Sidebar slides in/out correctly
- Folders navigate as stack (push/pop)
- Back button and menu icon switch correctly
- Edge swipe works from folders, not from editor

---

### Phase 3: Daily Notes & Calendar Integration
**Status**: ⬜ Not Started
**Objective**: Implement Daily Notes system folder and integrate with calendar

**Deliverables:**
- System folder "Daily Notes" (like Trash, cannot be deleted)
- "Daily Note" sidebar item that auto-creates today's note
- Calendar shows dots for days with daily notes
- Tapping calendar date with daily note opens it
- Daily note title format: "YYYY-MM-DD" or localized date

**Exit Criteria:**
- Tapping Daily in sidebar opens/creates today's note
- Calendar shows daily note indicators
- Daily notes stored in special folder

---

### Phase 4: Quick Access & Pinned Notes
**Status**: ⬜ Not Started
**Objective**: Implement global Quick Access and per-folder pinned notes

**Deliverables:**
- `isQuickAccess` field in note_metadata
- Quick Access section in sidebar (lists all quick access notes)
- Toggle Quick Access from note options menu
- `isPinned` field in note_metadata
- Pinned notes appear at top of folder list
- Pin/unpin from note options menu

**Exit Criteria:**
- Can mark/unmark notes as Quick Access
- Quick Access notes appear in sidebar
- Can pin/unpin notes within folders
- Pinned notes sort to top

---

### Phase 5: Tags System
**Status**: ⬜ Not Started
**Objective**: Implement tag creation, assignment, and filtering

**Deliverables:**
- `tags` table in SQLite (id, name, color)
- `tags` JSON field in note_metadata (array of tag IDs)
- Tag management UI (create, edit, delete tags)
- Assign tags to notes (multi-select)
- Display tags on note cards
- Filter notes by tag (within folder or global)

**Exit Criteria:**
- Can create tags with name and color
- Can assign multiple tags to notes
- Tags display on note list items
- Can filter by tag

---

### Phase 6: Note Links & Collapsible Sections
**Status**: ⬜ Not Started
**Objective**: Add internal note linking and collapsible sections to editor

**Deliverables:**
- Note link syntax (`[[Note Title]]`) or picker UI
- Link detection and rendering in editor
- Tapping link navigates to target note
- Collapsible section block in TipTap editor
- Toggle expand/collapse sections
- Persist collapsed state in content

**Exit Criteria:**
- Can insert links to other notes
- Links are clickable and navigate
- Can create collapsible sections
- Collapse state persists

---

### Phase 7: Version History
**Status**: ⬜ Not Started
**Objective**: Implement local version history with save/restore

**Deliverables:**
- `note_versions` table (id, noteId, content, createdAt)
- Auto-save version on significant edits (debounced, e.g., every 30s of changes)
- Version history UI (list of versions with timestamps)
- Version preview (read-only view)
- Restore version (replaces current content)
- Version limit (e.g., keep last 50)

**Exit Criteria:**
- Versions auto-save during editing
- Can view version history list
- Can preview any version
- Can restore previous version

---

### Phase 8: Note Info & Export
**Status**: ⬜ Not Started
**Objective**: Add note statistics and export functionality

**Deliverables:**
- Note info panel/modal (word count, char count, created, updated, folder)
- Word/char count updates in real-time during editing
- Export to Markdown (text generation)
- Export to HTML (from TipTap content)
- Export to PDF (using print/share APIs)
- Share sheet integration

**Exit Criteria:**
- Note info displays accurate counts
- Export to MD/HTML/PDF works
- Can share exported files

---

### Phase 9: Typography & Settings
**Status**: ⬜ Not Started
**Objective**: Add typography customization and settings infrastructure

**Deliverables:**
- Settings screen accessible from sidebar
- `settings` table in SQLite (key-value)
- Typography settings: font family, font size, line height
- Apply typography to editor
- Persist settings across sessions
- Backup UI shell (Coming soon placeholder)

**Exit Criteria:**
- Settings screen shows typography options
- Changing typography updates editor
- Settings persist in SQLite
- Backup shows "Coming soon"

---

### Phase 10: Polish — Rotation & Refinement
**Status**: ⬜ Not Started
**Objective**: Ensure rotation responsiveness and overall polish

**Deliverables:**
- All screens handle rotation gracefully
- Sidebar closes on rotation
- Editor reflows on rotation
- Consistent styling across all new components
- Performance optimization (list virtualization)
- Bug fixes from previous phases

**Exit Criteria:**
- Rotation works on all screens
- No layout breaks
- Smooth performance
- All success criteria from SPEC met

---

## Phase Dependencies

```
Phase 1 (Database) 
    ↓
Phase 2 (Navigation) 
    ↓
    ├── Phase 3 (Daily Notes)
    ├── Phase 4 (Quick Access/Pinned)
    └── Phase 5 (Tags)
           ↓
       Phase 6 (Links/Collapsible)
           ↓
       Phase 7 (Version History)
           ↓
       Phase 8 (Info/Export)
           ↓
       Phase 9 (Typography/Settings)
           ↓
       Phase 10 (Polish)
```

*Phases 3, 4, 5 can run in parallel after Phase 2 if desired.*

---

## Timeline Estimate

| Phase | Estimated Effort |
|-------|------------------|
| Phase 1: Database | 2-3 days |
| Phase 2: Navigation | 2-3 days |
| Phase 3: Daily Notes | 1 day |
| Phase 4: Quick Access/Pinned | 1 day |
| Phase 5: Tags | 1-2 days |
| Phase 6: Links/Collapsible | 1-2 days |
| Phase 7: Version History | 1-2 days |
| Phase 8: Info/Export | 1-2 days |
| Phase 9: Typography | 1 day |
| Phase 10: Polish | 2-3 days |
| **Total** | **~15-20 days** |

---

## Next Step

Run `/plan 1` to create detailed execution plan for Phase 1.
