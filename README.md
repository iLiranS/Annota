# Annota 📝

A private, local-first mobile note-taking application designed for speed, privacy, and rich text organization.

## ✨ Core Features

-   🏠 **Local-First & Offline**: Everything is stored directly on the device using SQLite. No external cloud dependencies, ensuring maximum privacy and instant access.
-   ✍️ **Desktop-Class Rich Text**: Full TipTap integration providing advanced formatting, tables, and media support within a mobile-optimized interface.
-   📁 **Hierarchical Organization**: A flexible folder system allowing for deep nesting and structured note management.
-   🖼 **Smart Image Handling**: Automatic image hashing and deduplication. Images are stored locally, resized for performance, and referenced via persistent IDs.
-   ⚡ **Aggressive Caching**: Uses Zustand for a dual-layer state management system—fetching from the database while keeping everything in-memory for zero-latency interactions.

## 🛠 Tech Stack

-   **Frontend**: React Native + Expo (Router, File-system, Image Manipulator).
-   **Editor**: TipTap (WebView-based).
-   **State**: Zustand (Store + Persistence).
-   **Database**: SQLite via Drizzle ORM.
-   **Storage**: Local file system for media.

## 🏗 System Logic

The app operates on a "Sync-on-Write" principle. The Zustand store acts as the primary source of truth for the UI, while background services ensure that every change is immediately mirrored to the SQLite database. Images are processed through a dedicated pipeline (Resize -> Hash -> Store) before being injected into the editor as base64 data URIs.
