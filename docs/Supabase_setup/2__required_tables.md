## 2\. Required Tables

The Annota database relies on 6 core public tables to manage user profiles and end-to-end encrypted user data.

#### User & Profile Management

Stores extended user information, storage quotas, and encryption salts.

`profiles`

<table class="editor-table" style="min-width: 192px;"><colgroup><col style="min-width: 64px;"><col style="min-width: 64px;"><col style="min-width: 64px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p><strong>Column</strong></p></td><td colspan="1" rowspan="1"><p><strong>Type</strong></p></td><td colspan="1" rowspan="1"><p><strong>Constraints / Default</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><strong>Primary Key</strong>, Foreign Key (<code>auth.users.id</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>created_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Default: <code>now()</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>updated_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Default: <code>now()</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>role</code></p></td><td colspan="1" rowspan="1"><p><code>user_role</code></p></td><td colspan="1" rowspan="1"><p>Default: <code>'free'</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>storage_used_bytes</code></p></td><td colspan="1" rowspan="1"><p><code>bigint</code></p></td><td colspan="1" rowspan="1"><p>Default: <code>0</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>sub_exp_date</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p>-</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>display_name</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p>-</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>salt</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p>-</p></td></tr></tbody></table>

#### Encrypted Entities

Stores the core encrypted payloads for the user's workspace. All tables include a `nonce` for cryptographic security and map directly to the user who owns them.

`encrypted_notes`

<table class="editor-table" style="min-width: 192px;"><colgroup><col style="min-width: 64px;"><col style="min-width: 64px;"><col style="min-width: 64px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p><strong>Column</strong></p></td><td colspan="1" rowspan="1"><p><strong>Type</strong></p></td><td colspan="1" rowspan="1"><p><strong>Constraints / Default</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><strong>Primary Key</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>user_id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Foreign Key (<code>auth.users.id</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>encrypted_data</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Max length: 204,800 bytes</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>nonce</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Max length: 100 chars</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>is_deleted</code></p></td><td colspan="1" rowspan="1"><p><code>boolean</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Default: <code>false</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>created_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>updated_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code></p></td></tr></tbody></table>

`encrypted_folders`

<table class="editor-table" style="min-width: 192px;"><colgroup><col style="min-width: 64px;"><col style="min-width: 64px;"><col style="min-width: 64px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p><strong>Column</strong></p></td><td colspan="1" rowspan="1"><p><strong>Type</strong></p></td><td colspan="1" rowspan="1"><p><strong>Constraints / Default</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><strong>Primary Key</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>user_id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Foreign Key (<code>auth.users.id</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>encrypted_data</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Max length: 2,500 chars</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>nonce</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Max length: 100 chars</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>is_deleted</code></p></td><td colspan="1" rowspan="1"><p><code>boolean</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Default: <code>false</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>created_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Default: <code>now()</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>updated_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code></p></td></tr></tbody></table>

`encrypted_files` (File Metadata)

<table class="editor-table" style="min-width: 192px;"><colgroup><col style="min-width: 64px;"><col style="min-width: 64px;"><col style="min-width: 64px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p><strong>Column</strong></p></td><td colspan="1" rowspan="1"><p><strong>Type</strong></p></td><td colspan="1" rowspan="1"><p><strong>Constraints / Default</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>id</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><strong>Primary Key</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>user_id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Foreign Key (<code>auth.users.id</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>mime_type</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>size_bytes</code></p></td><td colspan="1" rowspan="1"><p><code>bigint</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>nonce</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>created_at</code></p></td><td colspan="1" rowspan="1"><p><code>timestamptz</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Default: <code>now()</code></p></td></tr></tbody></table>

#### Relationships

Mapping tables to handle many-to-many relationships within the workspace.

`note_files` (Maps attachments to notes)

<table class="editor-table" style="min-width: 192px;"><colgroup><col style="min-width: 64px;"><col style="min-width: 64px;"><col style="min-width: 64px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p><strong>Column</strong></p></td><td colspan="1" rowspan="1"><p><strong>Type</strong></p></td><td colspan="1" rowspan="1"><p><strong>Constraints / Default</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p><code>note_id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><strong>Primary Key</strong>, Foreign Key (<code>encrypted_notes.id</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>file_id</code></p></td><td colspan="1" rowspan="1"><p><code>text</code></p></td><td colspan="1" rowspan="1"><p><strong>Primary Key</strong>, Foreign Key (<code>encrypted_files.id</code>)</p></td></tr><tr><td colspan="1" rowspan="1"><p><code>user_id</code></p></td><td colspan="1" rowspan="1"><p><code>uuid</code></p></td><td colspan="1" rowspan="1"><p><code>NOT NULL</code>, Foreign Key (<code>auth.users.id</code>)</p></td></tr></tbody></table>

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.encrypted_files (
  id text NOT NULL,
  user_id uuid NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  nonce text NOT NULL,
  CONSTRAINT encrypted_files_pkey PRIMARY KEY (id),
  CONSTRAINT encrypted_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.encrypted_folders (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  encrypted_data text NOT NULL CHECK (char_length(encrypted_data) <= 2500),
  nonce text NOT NULL CHECK (char_length(nonce) <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT encrypted_folders_pkey PRIMARY KEY (id),
  CONSTRAINT encrypted_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.encrypted_notes (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  encrypted_data text NOT NULL CHECK (octet_length(encrypted_data) <= 204800),
  nonce text NOT NULL CHECK (char_length(nonce) <= 100),
  CONSTRAINT encrypted_notes_pkey PRIMARY KEY (id),
  CONSTRAINT encrypted_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.encrypted_tags (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  encrypted_data text NOT NULL CHECK (char_length(encrypted_data) <= 1000),
  nonce text NOT NULL CHECK (char_length(nonce) <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT encrypted_tags_pkey PRIMARY KEY (id),
  CONSTRAINT encrypted_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.note_files (
  note_id uuid NOT NULL,
  file_id text NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT note_files_pkey PRIMARY KEY (note_id, file_id),
  CONSTRAINT note_files_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.encrypted_files(id),
  CONSTRAINT note_files_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.encrypted_notes(id),
  CONSTRAINT note_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  role USER-DEFINED DEFAULT 'free'::user_role,
  storage_used_bytes bigint DEFAULT 0,
  sub_exp_date timestamp with time zone,
  display_name text,
  salt text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
```