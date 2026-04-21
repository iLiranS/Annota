## 6\. Roles & Indexes

To maintain data integrity and query performance, Annota uses a custom PostgreSQL Enum for user tiers and composite indexes to speed up the syncing mechanism.

#### **A. Custom Enum Types**

The `user_role` enum defines the available subscription tiers and access levels within the application. This is primarily used in the `profiles` table to determine storage and entity limits.

**SQL Execution:**

SQL

```sql
-- Create the custom user_role enum
CREATE TYPE public.user_role AS ENUM ('free', 'beta', 'pro', 'admin');
```

#### **B. Database Indexes**

Indexes are crucial for maintaining fast query performance, especially since Annota relies heavily on filtering by the user (`user_id`) and fetching recent changes for offline-first syncing (`updated_at`).

**1\. Primary Key Indexes** When you created the tables earlier, PostgreSQL automatically generated B-tree indexes for all primary keys to ensure uniqueness and fast lookups. You do not need to run manual SQL for these, but they are tracked as follows:

*   `encrypted_files_pkey` (on `id`)
    
*   `encrypted_folders_pkey` (on `id`)
    
*   `encrypted_notes_pkey` (on `id`)
    
*   `encrypted_tags_pkey` (on `id`)
    
*   `note_files_pkey` (on `note_id`, `file_id`)
    
*   `profiles_pkey` (on `id`)
    

**2\. Performance Indexes** To optimize the `pull_sync_data` RPC and standard client queries, we apply composite indexes on the `user_id` and `updated_at` columns. This prevents full table scans when the client asks, _"Give me all my notes updated since yesterday."_

**SQL Execution:**

SQL

```sql
-- Composite indexes for optimized RLS filtering and time-based syncing
CREATE INDEX idx_folders_user_updated ON public.encrypted_folders (user_id, updated_at);
CREATE INDEX idx_notes_user_updated ON public.encrypted_notes (user_id, updated_at);
CREATE INDEX idx_tags_user_updated ON public.encrypted_tags (user_id, updated_at);
```