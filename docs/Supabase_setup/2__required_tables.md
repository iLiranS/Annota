## 2. Required Tables

The Annota database relies on 7 core public tables to manage user profiles, end-to-end encrypted user data, and note publishing.

### User & Profile Management

Stores extended user information, storage quotas, and encryption salts.

#### `profiles`

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key**, Foreign Key (`auth.users.id`) |
| `created_at` | `timestamptz` | `NOT NULL`, Default: `now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, Default: `now()` |
| `role` | `user_role` | Default: `'free'` |
| `storage_used_bytes` | `bigint` | Default: `0` |
| `sub_exp_date` | `timestamptz` | - |
| `display_name` | `text` | - |
| `salt` | `text` | - |

---

### Encrypted Entities

Stores the core encrypted payloads for the user's workspace. All tables include a `nonce` for cryptographic security and map directly to the user who owns them.

#### `encrypted_notes`

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key** |
| `user_id` | `uuid` | `NOT NULL`, Foreign Key (`auth.users.id`) |
| `encrypted_data` | `text` | `NOT NULL`, Max length: 204,800 bytes |
| `nonce` | `text` | `NOT NULL`, Max length: 100 chars |
| `is_deleted` | `boolean` | `NOT NULL`, Default: `false` |
| `created_at` | `timestamptz` | `NOT NULL` |
| `updated_at` | `timestamptz` | `NOT NULL` |

#### `encrypted_folders`

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key** |
| `user_id` | `uuid` | `NOT NULL`, Foreign Key (`auth.users.id`) |
| `encrypted_data` | `text` | `NOT NULL`, Max length: 2,500 chars |
| `nonce` | `text` | `NOT NULL`, Max length: 100 chars |
| `is_deleted` | `boolean` | `NOT NULL`, Default: `false` |
| `created_at` | `timestamptz` | `NOT NULL`, Default: `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` |

#### `encrypted_tags`

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key** |
| `user_id` | `uuid` | `NOT NULL`, Foreign Key (`auth.users.id`) |
| `encrypted_data` | `text` | `NOT NULL`, Max length: 1,000 chars |
| `nonce` | `text` | `NOT NULL`, Max length: 100 chars |
| `is_deleted` | `boolean` | `NOT NULL`, Default: `false` |
| `created_at` | `timestamptz` | `NOT NULL`, Default: `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` |

#### `encrypted_files` (File Metadata)

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `id` | `text` | **Primary Key** |
| `user_id` | `uuid` | `NOT NULL`, Foreign Key (`auth.users.id`) |
| `mime_type` | `text` | `NOT NULL` |
| `size_bytes` | `bigint` | `NOT NULL` |
| `nonce` | `text` | `NOT NULL` |
| `created_at` | `timestamptz` | `NOT NULL`, Default: `now()` |

---

### Published Content

#### `published_notes`

Manages notes that have been made public, storing plain-text markdown and titles for display.

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `note_id` | `uuid` | **Primary Key**, Foreign Key (`encrypted_notes.id`) |
| `user_id` | `uuid` | `NOT NULL`, Foreign Key (`auth.users.id`) |
| `md_data` | `text` | `NOT NULL`, Max length: 512,000 bytes |
| `published_at` | `timestamptz` | `NOT NULL`, Default: `now()` |
| `updated_at` | `timestamptz` | `NOT NULL`, Default: `now()` |
| `title` | `text` | `NOT NULL`, Default: `'Untitled Note'`, Max length: 255 chars |

---

### Relationships

#### `note_files` (Maps attachments to notes)

| Column | Type | Constraints / Default |
| :--- | :--- | :--- |
| `note_id` | `uuid` | **Primary Key**, Foreign Key (`encrypted_notes.id`) |
| `file_id` | `text` | **Primary Key**, Foreign Key (`encrypted_files.id`) |
| `user_id` | `uuid` | `NOT NULL`, Foreign Key (`auth.users.id`) |
