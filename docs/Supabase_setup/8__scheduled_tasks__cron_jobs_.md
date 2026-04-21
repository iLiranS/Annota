## 8\. Scheduled Tasks (Cron Jobs)

To maintain database performance and keep storage costs down, Annota relies on automated scheduled tasks via the `pg_cron` extension. These run daily to clean up soft-deleted ("tombstoned") records and orphaned files.

#### **A.** `cleanup_all_tombstones`

This job runs every day at midnight. It executes the `cleanup_deleted_encrypted_data()` Postgres function we defined earlier to purge soft-deleted entities older than 3 months and permanently shred the encrypted payloads of items deleted over 7 days ago.

*   **Schedule:** `0 0 * * *` (Daily at 00:00)
    
*   **Execution SQL:**
    

SQL

```sql
SELECT cron.schedule(
  'cleanup_all_tombstones',
  '0 0 * * *',
  $$ SELECT public.cleanup_deleted_encrypted_data(); $$
);
```

#### **B.** `trigger-cleanup-files`

Because deleting files from the `e2e_attachments` storage bucket cannot be done purely via standard SQL triggers, we use the `pg_net` extension to make an HTTP POST request to our `cleanup-files` Edge Function.

This job runs daily, passes the required authentication headers, and allows for a 60-second timeout to ensure the Deno environment has enough time to paginate through and delete large batches of orphaned files.

*   **Schedule:** Daily (e.g., `0 1 * * *` - scheduled an hour after the tombstone cleanup)
    
*   **Configuration:** \* **Method:** HTTP POST
    
    *   **Headers:** `Content-Type: application/json` & `Authorization: Bearer [ANON_KEY]`
        
    *   **Timeout:** 60,000 ms
        
*   **Execution SQL:** _(Note: Replace_ `<PROJECT_REF>` _and_ `<YOUR_ANON_KEY>` _with your actual Supabase project reference ID and Anon Key)._
    

SQL

```sql
SELECT cron.schedule(
  'trigger-cleanup-files',
  '0 1 * * *',
  $$
  SELECT net.http_post(
      url:='https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-files',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
      timeout_milliseconds:=60000
  );
  $$
);
```