## 7\. Storage Buckets

Annota utilizes Supabase Storage to handle both encrypted user attachments and public application configurations.

#### **A. Bucket Definitions**

You must create two distinct buckets in your Supabase Storage dashboard:

1.  `e2e_attachments`
    
    *   **Purpose:** Stores all encrypted user files (images, documents, etc.) attached to notes. Files are strictly organized into folders named by the user's `auth.uid()`.
        
    *   **File Size Limit:** 7MB per file.
        
    *   **Public Access:** False.
        
2.  `app-config`
    
    *   **Purpose:** A lightweight system bucket for remote application configuration. Currently, it houses a `flags.json`file (e.g., `{"sync_disabled": false}`) that the client fetches on launch to check for emergency maintenance states.
        
    *   **File Size Limit:** 1MB.
        
    *   **Public Access:** True (Read-only).
        

#### **B. Storage RLS Policies**

Because Supabase Storage uses the underlying Postgres database, we apply RLS directly to the `storage.objects` table. These policies enforce public access for the config file, strictly isolate user directories, and dynamically calculate storage limits upon upload.

You can execute the following SQL to apply these policies:

SQL

```sql
-- 1. Read access for App Config
CREATE POLICY "Anyone can read system buckets" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'app-config');

-- 2. Read access for User Files
CREATE POLICY "Users can read their own files" 
ON storage.objects FOR SELECT TO authenticated 
USING (
  bucket_id <> 'app-config' 
  AND owner = auth.uid() 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Update access for User Files
CREATE POLICY "Users can update their own files" 
ON storage.objects FOR UPDATE TO authenticated 
USING (
  bucket_id <> 'app-config' 
  AND owner = auth.uid() 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Delete access for User Files
CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE TO authenticated 
USING (
  bucket_id <> 'app-config' 
  AND owner = auth.uid() 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Insert access & Tiered Storage Limit Enforcement
-- NOTE: Limits are currently set to 50MB (Pro/Beta) and 25MB (Free) for the beta phase.
-- These byte thresholds can be adjusted as the app scales.
CREATE POLICY "Enforce tiered storage limits" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id <> 'app-config' 
  AND (storage.foldername(name))[1] = auth.uid()::text 
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND (
      p.storage_used_bytes + COALESCE((metadata->>'size')::bigint, 0)
    ) <= CASE
      WHEN p.role IN ('pro', 'beta', 'admin') AND p.sub_exp_date > now() 
      THEN 52428800 -- 50 MB limit
      ELSE 26214400 -- 25 MB limit
    END
  )
);
```

* * *