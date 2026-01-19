# DECISIONS.md — Architecture Decision Record

> Log of significant technical decisions made during the project.

---

## ADR-001: SQLite for Local Database

**Date:** 2026-01-19
**Status:** Accepted

**Context:**
Need a local database for the notes app that works offline, supports structured queries, and is reliable for mobile.

**Decision:**
Use SQLite via `expo-sqlite` or `drizzle-orm` as the local database.

**Rationale:**
- Industry standard for mobile apps
- Relational queries support our folder/note/tag relationships
- Works completely offline
- Easy migration path to sync scenarios
- Better than AsyncStorage for structured data

**Alternatives Considered:**
- WatermelonDB: More complex, but better for sync scenarios
- Realm: Good performance but adds complexity
- AsyncStorage: Too limited for relational data

---

## ADR-002: Data Split — Metadata vs Content

**Date:** 2026-01-19
**Status:** Accepted

**Context:**
Need to support future web app with lazy-loading and efficient mobile sync.

**Decision:**
Split notes into two tables:
- `note_metadata`: id, folderId, title, preview, timestamps, flags
- `note_content`: noteId, content

**Rationale:**
- Web can fetch metadata for sidebar, load content on demand
- Mobile can sync metadata quickly, content in background
- Reduces initial payload for large note collections
- Enables efficient "last updated" queries

---

## ADR-003: Sidebar Always Slide-In

**Date:** 2026-01-19
**Status:** Accepted

**Context:**
Question of whether sidebar should be persistent on tablets.

**Decision:**
Sidebar is always slide-in/slide-out, even on large screens.

**Rationale:**
- Consistent UX across all devices
- Maximizes content area
- Simpler implementation
- User explicitly requested this behavior

---

## ADR-004: Version History Local-Only

**Date:** 2026-01-19
**Status:** Accepted

**Context:**
Where to store note version history.

**Decision:**
Store version history only in local SQLite, never sync to backend.

**Rationale:**
- Reduces backend storage costs
- Simplifies sync logic (no version conflicts)
- User explicitly requested local-only
- Versions are per-device (acceptable trade-off)

---

## ADR-005: Tasks as Separate Module

**Date:** 2026-01-19
**Status:** Accepted

**Context:**
Whether to merge tasks into notes or keep separate.

**Decision:**
Keep Tasks as a completely separate module with its own table.

**Rationale:**
- Different data model (deadline, completed vs content)
- Allows independent future development
- Cleaner separation of concerns
- User explicitly requested this

---
