## 5\. Edge Functions

Annota utilizes Supabase Edge Functions (running on Deno) to execute backend logic that requires elevated privileges (Service Role key) or needs to run as a scheduled cron job.

#### **A.** `cleanup-files`

A maintenance function designed to run via a scheduled cron job (e.g., pg\_cron or a GitHub Action). It pairs with the `get_orphaned_files_for_deletion` RPC to permanently wipe unlinked files from the `e2e_attachments` storage bucket, followed by their metadata in the database.

*   **Trigger:** Scheduled Cron Job
    
*   **Permissions:** Service Role (Bypasses RLS to delete from Storage and DB)
    

TypeScript

```sql
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req: Request) => {
    try {
        // 1. Fetch orphaned files using the new generic RPC
        const { data: filesToDelete, error: sqlError } = await supabase.rpc('get_orphaned_files_for_deletion');

        if (sqlError) throw sqlError;

        // 2. Exit early if nothing to clean up
        if (!filesToDelete || filesToDelete.length === 0) {
            return new Response(JSON.stringify({ message: 'No orphans found' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        }

        console.log(`Found ${filesToDelete.length} orphaned files.`);

        // 3. Prepare paths and delete from the unified Storage Bucket
        const pathsToDelete = filesToDelete.map((file: { id: string, user_id: string }) => `${file.user_id}/${file.id}`);
        const { error: storageError } = await supabase
            .storage
            .from('e2e_attachments') // <-- Updated bucket
            .remove(pathsToDelete);

        if (storageError) throw storageError;

        // 4. Delete the metadata rows from the unified database table
        const idsToDelete = filesToDelete.map((file: { id: string }) => file.id);
        const { error: dbError } = await supabase
            .from('encrypted_files') // <-- Updated table
            .delete()
            .in('id', idsToDelete);

        if (dbError) throw dbError;

        return new Response(
            JSON.stringify({ success: true, deleted: filesToDelete.length }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (err) {
        // Safely handle the unknown error type
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error('Cleanup failed:', errorMessage);

        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
```

#### **B.** `manage-user-data`

A client-facing function triggered when a user requests to either completely delete their account or factory reset their workspace. It securely validates the user's JWT, paginates through and empties their storage directory, and then applies the destructive action.

*   **Trigger:** Client HTTP Request (Includes CORS handling)
    
*   **Permissions:** Validates user Auth, executes destructive actions via Admin/Service Role key.
    

TypeScript

```sql
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// 1. Define CORS headers for React Native / Web compatibility
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // 2. Intercept and approve CORS preflight requests immediately
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { action } = await req.json();

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        // Authenticate the user securely
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) throw new Error(`Auth failed: ${authError?.message}`);
        const userId = user.id;

        // Initialize Admin Client
        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

        // WIPE STORAGE (Paginated)
        let hasMoreFiles = true;
        while (hasMoreFiles) {
            const { data: files, error: listError } = await adminClient.storage
                .from('e2e_attachments')
                .list(userId, { limit: 100 });

            if (listError) throw listError;

            if (!files || files.length === 0) {
                hasMoreFiles = false;
                break;
            }

            const pathsToRemove = files.map(file => `${userId}/${file.name}`);
            const { error: removeError } = await adminClient.storage
                .from('e2e_attachments')
                .remove(pathsToRemove);

            if (removeError) throw removeError;
            if (files.length < 100) hasMoreFiles = false;
        }

        // HANDLE DATABASE / ACCOUNT
        if (action === 'delete_account') {
            const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
            if (deleteError) throw deleteError;
        }
        else if (action === 'reset_data') {
            const { error: resetError } = await userClient.rpc('reset_user_data');
            if (resetError) throw resetError;
        }
        else {
            throw new Error('Invalid action');
        }

        // 3. Always attach CORS headers to successful responses
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        // 4. Safely stringify Supabase API errors so they don't get lost
        const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
        console.error('Edge Function Error:', errorMessage);

        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
```