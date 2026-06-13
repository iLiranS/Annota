## 5\. Edge Functions

Annota utilizes Supabase Edge Functions (running on Deno) to execute backend logic that requires elevated privileges (Service Role key) or needs to run as a scheduled cron job.

#### **A.** `cleanup-files`

A maintenance function triggered via a scheduled cron job. It pairs with the `get_orphaned_files_for_deletion` RPC to permanently wipe unlinked files from the `e2e_attachments` storage bucket and delete their metadata.

*   **Trigger:** Scheduled Cron Job
    
*   **Security:** Verifies `CRON_SECRET` via Authorization header.
    

TypeScript

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''; 

const chunkArray = <T>(array: T[], size: number): T[][] => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

Deno.serve(async (req: Request) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== `Bearer ${CRON_SECRET}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const { data: filesToDelete, error: sqlError } = await supabase.rpc('get_orphaned_files_for_deletion');
        if (sqlError) throw sqlError;

        if (!filesToDelete || filesToDelete.length === 0) {
            return new Response(JSON.stringify({ message: 'No orphans found' }), { status: 200 });
        }

        const BATCH_SIZE = 100;

        // Batch Delete from Storage
        const pathsToDelete = filesToDelete.map((file: { id: string, user_id: string }) => `${file.user_id}/${file.id}`);
        for (const chunk of chunkArray(pathsToDelete, BATCH_SIZE)) {
            const { error: storageError } = await supabase.storage.from('e2e_attachments').remove(chunk);
            if (storageError) throw storageError;
        }

        // Batch Delete from Database
        const idsToDelete = filesToDelete.map((file: { id: string }) => file.id);
        for (const chunk of chunkArray(idsToDelete, BATCH_SIZE)) {
            const { error: dbError } = await supabase.from('encrypted_files').delete().in('id', chunk);
            if (dbError) throw dbError;
        }

        return new Response(JSON.stringify({ success: true, deleted: filesToDelete.length }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500 });
    }
});
```

#### **B.** `manage-user-data`

A client-facing function triggered when a user requests an account deletion or factory reset. It validates the user's JWT and performs paginated deletion of storage objects and database records.

*   **Trigger:** Client HTTP Request (Includes CORS handling)
    
*   **Permissions:** Validates user Auth, executes destructive actions via Admin/Service Role key.
    

TypeScript

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('ADMIN_SERVICE_KEY') ?? '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { action } = await req.json();
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) throw new Error(`Auth failed`);
        const userId = user.id;

        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Paginated Storage Wipe
        let offset = 0;
        while (true) {
            const { data: files, error: listError } = await adminClient.storage
                .from('e2e_attachments').list(userId, { limit: 100, offset });
            if (listError || !files || files.length === 0) break;

            const pathsToRemove = files.map(file => `${userId}/${file.name}`);
            const { error: removeError } = await adminClient.storage.from('e2e_attachments').remove(pathsToRemove);
            if (removeError) throw removeError;
            
            offset += files.length;
            if (files.length < 100) break;
        }

        if (action === 'delete_account') {
            await adminClient.auth.admin.deleteUser(userId);
        } else if (action === 'reset_data') {
            await userClient.rpc('reset_user_data');
        } else {
            throw new Error('Invalid action');
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders }, status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders }, status: 400 });
    }
});
```