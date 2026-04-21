# Annota 📝

A private, local-first mobile note-taking application designed for speed, privacy, and rich text organization.
![App Screenshot](docs/images/preview.png)


## ✨ Core Features

-   🏠 **Local-First & Offline**: Everything is stored directly on the device using SQLite. No external cloud dependencies, ensuring maximum privacy and instant access.
-   ✍️ **Desktop-Class Rich Text**: Full TipTap integration providing advanced formatting, tables, and media support within a mobile-optimized interface.
-   📁 **Hierarchical Organization**: A flexible folder system allowing for deep nesting and structured note management.
-   🧷 **Smart File Handling**: Automatic double hashing and deduplication. Files are stored locally, Images resized for performance, and referenced via persistent IDs.
-   ⚡ **Aggressive Caching**: Uses Zustand for a dual-layer state management system—fetching from the database while keeping everything in-memory for zero-latency interactions.
- 🌐 **Server**:(Optional) Supabase for sync and backup w/ end to end encryption (client side) with auto cleanup to minimize storage.

## 🛠 Tech Stack

-   **Frontend**: React Native + Expo (Mobile) , Tauri (Desktop)
-   **Editor**: TipTap + Extensions.
-   **State**: Zustand (Store + Persistence).
-   **Database**: SQLite via Drizzle ORM.
-   **Storage**: Local file system for media.
-   **Backend**: Supabase (Optional)

## 

## Environment Variables

To run Annota, you will need to add the following environment variables to your mobile .env and desktop .env relatively **(unless fully offline)** :

`EXPO_PUBLIC_SUPABASE_KEY`

`EXPO_PUBLIC_SUPABASE_UR`

`VITE_SUPABASE_URL`

`VITE_SUPABASE_KEY`

## ☁️ Supabase Setup

To enable sync and backup features, follow these setup guides in order:

1. [Initial Setup](./docs/Supabase_setup/1__initial_setup.md)
2. [Required Tables](./docs/Supabase_setup/2__required_tables.md)
3. [Row Level Security](./docs/Supabase_setup/3__rls___row_level_security.md)
4. [Database Functions & Triggers](./docs/Supabase_setup/4__database_functions___triggers.md)
5. [Edge Functions](./docs/Supabase_setup/5__edge_functions.md)
6. [Roles & Indexes](./docs/Supabase_setup/6__roles___indexes.md)
7. [Storage Buckets](./docs/Supabase_setup/7__storage_buckets.md)
8. [Scheduled Tasks & Cron Jobs](./docs/Supabase_setup/8__scheduled_tasks__cron_jobs_.md)

*Note: Full local support without any Supabase setup is coming soon.*


## Run Locally

Annota is built with a local-first architecture. You can clone the repository and run it locally with minimal effort and knowledge—no server is strictly required for the core experience.




### 1. Clone the project

```bash
  git clone https://github.com/iLiranS/Annota
```

### 2. Install dependencies

```bash
  pnpm install
```

### 3. Start the application

Navigate to the respective app directory and run:

**Mobile:**
```bash
  cd apps/mobile
  pnpm start
```

**Desktop:**
```bash
  cd apps/desktop
  pnpm tauri dev
```


## Contributing

Contributions are always welcome!

We currently looking for active testers - especially for Windows / Android compatibility, and further improvements to the systems.

