# Architecture

## Overview
Annota is a mobile-first Note Taking application built with React Native and Expo. It allows users to create rich text notes, organize them into folders, and manage them efficiently. The app follows a local-first architecture using SQLite for persistence and Zustand for state management.

## Core Components

### 1. Store (State Management)
- **Location**: `stores/notes-store.ts`
- **Purpose**: Centralized state management using Zustand. It caches all notes and folders in memory for fast access ("Aggressive Caching") while synchronizing write operations to the database.
- **Pattern**: Flux-like with Actions and State.

### 2. Services (Data Layer)
- **Location**: `lib/services/`
- **Purpose**: Handles direct database interactions (SQLite).
- **Files**:
    - `notes.service.ts`: CRUD operations for Notes.
    - `folders.service.ts`: CRUD operations for Folders.
    - `db/schema.ts`: Database schema definitions using Drizzle ORM (inferred from imports).

### 3. Editor
- **Location**: `components/tiptap-editor/`
- **Purpose**: Rich text editing capabilities.
- **Implementation**: Wraps a webview running TipTap editor for rich text manipulation.

### 4. Navigation
- **Location**: `app/`
- **Purpose**: File-based routing using Expo Router.
- **Structure**:
    - `(drawer)`: Main navigation structure (Drawer).
    - `Notes/[id]`: dynamic route for editing notes.

## Data Flow

1. **Initialization**:
   - `stores/notes-store.ts` initializing loads all Folders and Notes from the Database via Services.
   - Data is stored in the Zustand store.

2. **User Interaction (View/Edit)**:
   - Components (e.g., `NoteEditor`) subscribe to Zustand store.
   - User edits content -> `TipTapEditor` captures changes -> `NoteEditor` calls `updateNoteContent` action.

3. **Persistence**:
   - Action calls Service (e.g., `NoteService.updateContent`).
   - Service writes to SQLite.
   - Action updates local Zustand state to reflect changes immediately.

## Tech Stack
- **Framework**: Expo / React Native
- **Router**: Expo Router
- **State**: Zustand
- **Database**: Expo SQLite + Drizzle ORM
- **Editor**: TipTap (WebView)
- **UI**: React Native Styled Components / StyleSheet
