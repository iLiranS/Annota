# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
A robust, local-first note-taking application that prioritizes zero-latency UI interactions and data integrity. The architecture uses "Aggressive Caching" (loading data into memory) to ensure responsiveness, but this requires surgical precision in state updates to avoid expensive reloads.

## Goals
1.  **Eliminate "Reload on Write" Anti-Pattern**: The `initApp()` method, which reloads the entire database, must NEVER be called after user actions (like Restore or Empty Trash). All state updates must be atomic and surgical.
2.  **Fix Cascading Logic**: Restore, Delete, and other hierarchical operations must correctly handle deep folder structures, ensuring that deleted descendants are properly tracked and restored.
3.  **Data Integrity**: Ensure that the in-memory state in Zustand exactly matches the persistent state in SQLite without relying on blanket re-fetching.

## Non-Goals (Out of Scope)
-   Cloud Sync (Planned for a future milestone)
-   Collaboration features
-   New editor capabilities (Focus is on architecture)

## Users
-   **Local Mobile User**: Wants a fast, reliable place to store notes without lag or data loss.

## Constraints
-   **Performance**: UI updates must be optimistic and instant (0ms latency perception).
-   **Tech Stack**: React Native (Expo), TypeScript, Zustand, Drizzle ORM, SQLite.
-   **Persistence**: All changes must be transactionally safe in SQLite.

## Success Criteria
-   [ ] `initApp()` is only called ONCE at application startup.
-   [ ] Restoring a folder with deleted sub-folders restores the entire subtree correctly.
-   [ ] Empty Trash operation updates the UI instantly without a loading spinner or flash.
-   [ ] Unit/Integration tests or manual verification scripts confirm that descendants are found even when `isDeleted=true`.
