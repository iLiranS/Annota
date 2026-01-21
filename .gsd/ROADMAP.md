# ROADMAP.md

> **Current Phase**: Phase 1
> **Milestone**: v1.0 Foundation

## Must-Haves (from SPEC)
- [ ] Atomic `restoreFolder` without `initApp`
- [ ] Atomic `emptyTrash` without `initApp`
- [ ] Correct recursive descendant fetching (ignoring `isDeleted` flag)

## Phases

### Phase 1: Core Architecture Fixes
**Status**: ⬜ Not Started
**Objective**: Fix the "Reload on Write" anti-pattern and restoration bugs.
**Requirements**: REQ-01, REQ-02

### Phase 2: Data Integrity & Optimization
**Status**: ⬜ Not Started
**Objective**: optimize `emptyTrash` and general heavy operations.
**Requirements**: REQ-03

### Phase 3: Sync Preparation
**Status**: ⬜ Not Started
**Objective**: Prepare data models for partial sync (separating metadata).
