## 4\. Database Functions & Triggers

Annota uses several PostgreSQL functions and triggers to enforce business logic, track storage, maintain data integrity, and facilitate efficient client syncing.

**A. Trigger Functions**

These functions are bound to specific tables and execute automatically during `INSERT`, `UPDATE`, or `DELETE` events.

**1\.** `handle_new_user` **(Auth Trigger)** Fired automatically when a new user signs up in Supabase Auth.

*   **Table:** `auth.users` (Supabase system table)
    
*   **Event:** `AFTER INSERT`
    

```sql
BEGIN
  INSERT INTO public.profiles (id, role, salt)
  VALUES (
    new.id, 
    'free', 
    encode(extensions.gen_random_bytes(16), 'hex')
  );
  RETURN new;
END;
```

**2\.** `enforce_entity_limits` Prevents users from exceeding their plan's limits for notes, folders, and tags. It dynamically checks their current subscription tier.

*   **Tables:** `encrypted_notes`, `encrypted_folders`, `encrypted_tags`
    
*   **Events:** `BEFORE INSERT` (Triggers: `check_notes_limit`, `check_folders_limit`, `check_tags_limit`)
    

SQL

```sql
DECLARE
  u_role text;
  u_exp timestamptz;
  current_count integer;
  max_limit integer;
  query_str text;
BEGIN
  -- Fetch the user's role and subscription expiration date
  SELECT role::text, sub_exp_date INTO u_role, u_exp 
  FROM public.profiles 
  WHERE id = NEW.user_id;

  -- Determine effective role: If Pro or Beta but expired, treat as Free
  IF u_role IN ('pro', 'beta') AND u_exp IS NOT NULL AND u_exp < now() THEN
    u_role := 'free';
  END IF;

  -- Default to free if role is somehow null or unrecognized
  IF u_role IS NULL THEN
      u_role := 'free';
  END IF;

  -- Matrix: Set the maximum allowed items based on Role AND Table
  IF u_role IN ('pro', 'beta','admin') THEN
    CASE TG_TABLE_NAME
      WHEN 'encrypted_notes' THEN max_limit := 7500;
      WHEN 'encrypted_folders' THEN max_limit := 1000;
      WHEN 'encrypted_tags' THEN max_limit := 1000;
      ELSE max_limit := 7500; -- Fallback
    END CASE;
  ELSE
    -- Free tier limits
    CASE TG_TABLE_NAME
      WHEN 'encrypted_notes' THEN max_limit := 50;
      WHEN 'encrypted_folders' THEN max_limit := 10;
      WHEN 'encrypted_tags' THEN max_limit := 10;
      ELSE max_limit := 10; -- Fallback
    END CASE;
  END IF;

-- Dynamically count the user's ACTIVE items for the specific table
  query_str := format('SELECT count(*) FROM %I WHERE user_id = $1 AND is_deleted = false', TG_TABLE_NAME);
  EXECUTE query_str INTO current_count USING NEW.user_id;

  -- Block the insert if they are at or over the limit
  IF current_count >= max_limit THEN
    RAISE EXCEPTION 'Limit of % reached for % on current plan.', max_limit, TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
```

**3\.** `protect_sensitive_profile_fields` A security measure to prevent users from modifying restricted data (like storage limits or their role) via standard client API updates.

*   **Table:** `profiles`
    
*   **Event:** `BEFORE UPDATE` (Trigger: `ensure_profile_security`)
    

SQL

```sql
BEGIN
  -- Allow if the direct database user is an admin (Dashboard) 
  -- OR if the API JWT role is 'service_role' (Edge Functions)
  IF current_role NOT IN ('postgres', 'supabase_admin') 
     AND coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') != 'service_role' THEN
    
    -- Force the role to stay exactly what it was
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role = OLD.role;
    END IF;

    -- Prevent bypassing storage usage
    IF NEW.storage_used_bytes IS DISTINCT FROM OLD.storage_used_bytes THEN
      NEW.storage_used_bytes = OLD.storage_used_bytes;
    END IF;

    -- Prevent bypassing subscription expiration
    IF NEW.sub_exp_date IS DISTINCT FROM OLD.sub_exp_date THEN
      NEW.sub_exp_date = OLD.sub_exp_date;
    END IF;

  END IF;
  
  RETURN NEW;
END;
```

**4\.** `track_storage_usage` Automatically recalculates a user's total used storage inside their `profiles` row whenever an encrypted file is uploaded, updated, or removed.

*   **Table:** `encrypted_files`
    
*   **Events:** `AFTER INSERT`, `AFTER UPDATE`, `AFTER DELETE` (Trigger: `on_file_change`)
    

SQL

```sql
BEGIN
  -- Handle new file uploads
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.size_bytes, 0)
    WHERE id = NEW.user_id;
    
  -- Handle file overwrites/updates (rare in E2EE, but good to have)
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET storage_used_bytes = storage_used_bytes 
                             - COALESCE(OLD.size_bytes, 0) 
                             + COALESCE(NEW.size_bytes, 0)
    WHERE id = NEW.user_id;

  -- Handle file deletions (e.g., from your orphan cleanup cron job)
-- Handle file deletions
  ELSIF TG_OP = 'DELETE' THEN
    -- Only update if the profile still exists to prevent issues during cascade user deletion
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id) THEN
      UPDATE public.profiles
      SET storage_used_bytes = storage_used_bytes - COALESCE(OLD.size_bytes, 0)
      WHERE id = OLD.user_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
```

#### **B. Client RPCs (Remote Procedure Calls)**

These functions are executed directly from the frontend via `supabase.rpc()`.

**1\.** `pull_sync_data` Optimized fetching mechanism using cursor-based pagination. Returns all modified entities since the provided timestamps and IDs in a single JSON payload.

SQL

```sql
CREATE OR REPLACE FUNCTION public.pull_sync_data(
  p_last_sync timestamp,
  p_folders_time timestamp, p_folders_id uuid,
  p_notes_id uuid,
  p_tags_time timestamp, p_tags_id uuid
) RETURNS json LANGUAGE plpgsql AS $$
declare
  v_folders json;
  v_notes json;
  v_tags json;
  v_actual_folders_time timestamp;
  v_actual_tags_time timestamp;
begin
  -- Fallback for legacy clients
  v_actual_folders_time := case when p_folders_time = '1970-01-01'::timestamp then p_last_sync else p_folders_time end;
  v_actual_tags_time := case when p_tags_time = '1970-01-01'::timestamp then p_last_sync else p_tags_time end;

  select json_agg(t) into v_folders from (
    select * from encrypted_folders 
    where (updated_at > v_actual_folders_time) 
       or (updated_at = v_actual_folders_time and id > p_folders_id)
    order by updated_at asc, id asc limit 100
  ) t;

  select json_agg(t) into v_notes from (
    select * from encrypted_notes 
    where (updated_at > p_last_sync) 
       or (updated_at = p_last_sync and id > p_notes_id)
    order by updated_at asc, id asc limit 100
  ) t;

  select json_agg(t) into v_tags from (
    select * from encrypted_tags 
    where (updated_at > v_actual_tags_time) 
       or (updated_at = v_actual_tags_time and id > p_tags_id)
    order by updated_at asc, id asc limit 100
  ) t;

  return json_build_object(
    'folders', coalesce(v_folders, '[]'::json),
    'notes', coalesce(v_notes, '[]'::json),
    'tags', coalesce(v_tags, '[]'::json)
  );
end;
$$;
```

**2\.** `replace_note_files` Safely overwrites file attachments for a note. Includes strict validation to ensure the file exists and is owned by the calling user.

SQL

```sql
CREATE OR REPLACE FUNCTION public.replace_note_files(
  p_note_id uuid, p_user_id uuid, p_file_ids text[]
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.encrypted_notes WHERE id = p_note_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  DELETE FROM public.note_files WHERE note_id = p_note_id AND user_id = p_user_id;

  INSERT INTO public.note_files (note_id, file_id, user_id)
  SELECT p_note_id, file_id, p_user_id
  FROM (SELECT DISTINCT unnest(COALESCE(p_file_ids, ARRAY[]::text[])) AS file_id) ids
  WHERE ids.file_id <> '' AND EXISTS (
      SELECT 1 FROM public.encrypted_files ef WHERE ef.id = ids.file_id AND ef.user_id = p_user_id
  );
END;
$$;
```

**3\.** `reset_user_data` Wipes all application data for the calling user, allowing for a clean slate.

SQL

```sql
CREATE OR REPLACE FUNCTION public.reset_user_data() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    calling_user_id uuid := auth.uid();
BEGIN
    IF calling_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    DELETE FROM note_files WHERE user_id = calling_user_id;
    DELETE FROM encrypted_files WHERE user_id = calling_user_id;
    DELETE FROM encrypted_tags WHERE user_id = calling_user_id;
    DELETE FROM encrypted_folders WHERE user_id = calling_user_id;
    DELETE FROM encrypted_notes WHERE user_id = calling_user_id;
END;
$$;
```

#### **C. Maintenance Functions (Cron / Edge Functions)**

These functions are designed to be run periodically by a server-side process or pg\_cron to clean up the database.

**1\.** `cleanup_deleted_encrypted_data` Purges tombstoned data older than 3 months and shreds encrypted payloads for items older than 7 days.

SQL

```sql
CREATE OR REPLACE FUNCTION public.cleanup_deleted_encrypted_data() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- 1. PURGE ANCIENT TOMBSTONES
  DELETE FROM public.encrypted_notes WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '3 months';
  DELETE FROM public.encrypted_folders WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '3 months';
  DELETE FROM public.encrypted_tags WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '3 months';

  -- 2. SEVER FILES TIES
  DELETE FROM public.note_files WHERE note_id IN (
    SELECT id FROM public.encrypted_notes WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '7 days'
  );

  -- 3. CREATE SKINNY TOMBSTONES
  UPDATE public.encrypted_notes SET encrypted_data = '', nonce = '' WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '7 days' AND encrypted_data != '';
  UPDATE public.encrypted_folders SET encrypted_data = '', nonce = '' WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '7 days' AND encrypted_data != '';
  UPDATE public.encrypted_tags SET encrypted_data = '', nonce = '' WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '7 days' AND encrypted_data != '';
END;
$$;
```

**2\.** `get_orphaned_files_for_deletion` Returns a list of files with no remaining note attachments, intended for storage bucket cleanup.

SQL

```sql
CREATE OR REPLACE FUNCTION public.get_orphaned_files_for_deletion() 
RETURNS TABLE(id text, user_id uuid) LANGUAGE sql AS $$
  select i.id, i.user_id
  from public.encrypted_files i
  where not exists (select 1 from public.note_files ni where ni.file_id = i.id)
  AND i.created_at < NOW() - INTERVAL '7 days';
$$;
```

* * *