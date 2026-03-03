# @annota/desktop

Tauri desktop app for Annota.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`
3. Install dependencies from repo root:
   - `pnpm install`

## Run

- Web build check:
  - `pnpm --filter @annota/desktop build`
- Tauri dev:
  - `pnpm --filter @annota/desktop tauri dev`

## Current bootstrap

- `src/main.tsx` wires:
  - `setStorageEngine(...)` for core persistence
  - `initPlatformAdapters(createDesktopAdapters())`
  - `initDesktopSqlite()` for native SQLite PRAGMA bootstrap
- `src/App.tsx` is an adapter self-check screen for:
  - network/appState/toast
  - secureStore
  - crypto
  - fileSystem
  - image permission path

