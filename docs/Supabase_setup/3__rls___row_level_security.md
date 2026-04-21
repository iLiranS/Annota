## 3\. RLS - Row Level Security

Since Annota handles encrypted payloads, strict Row Level Security is required. By default, tables in Supabase do not have RLS enabled, meaning any authenticated user could potentially query the entire database via the API.

First, we must enable RLS on all active tables (run those in SQL Editor in Supabase dashboard):

```sql
-- Enable RLS on all tables
ALTER TABLE public.encrypted_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

#### Entity Policies (Full Access for Owners)

For notes, folders, tags, files, and their relations, users have full CRUD (Create, Read, Update, Delete) access to their own rows. This is enforced by matching the `auth.uid()` to the `user_id` column.

```sql
-- Encrypted Files
CREATE POLICY "Users can manage their own files" 
ON public.encrypted_files FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Encrypted Folders
CREATE POLICY "Users can manage their own folders" 
ON public.encrypted_folders FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Encrypted Notes
CREATE POLICY "Users can manage their own notes" 
ON public.encrypted_notes FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Encrypted Tags
CREATE POLICY "Users can manage their own tags" 
ON public.encrypted_tags FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Note Files (Relations)
CREATE POLICY "Users can manage their own note_files" 
ON public.note_files FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
```

#### Profile Policies (Restricted Access)

The `profiles` table is handled differently. Because the primary key is `id` (matching `auth.users.id`), the RLS checks against `id`rather than `user_id`. Furthermore, users can only `SELECT` and `UPDATE` their profiles, restricting them from deleting their profile directly from the client.

_(Note: Data integrity during updates, such as preventing users from modifying their own_ `role` _or_ `storage_used_bytes`_, is handled separately via database triggers)._

```sql
-- View Profile (SELECT)
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- Update Profile (UPDATE)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);
```