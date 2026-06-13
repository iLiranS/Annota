# 6. Published Notes System

The `published_notes` system allows users to share content publicly. It includes strict publishing limits, administrative access checks, and an automated revalidation pipeline to ensure the website stays synchronized with the database.

## A. Edge Function: fetch-public-note

Securely retrieves public note data for the web frontend using a shared secret.

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const NEXT_JS_SHARED_SECRET = Deno.env.get('NEXT_JS_SHARED_SECRET') ?? '';

Deno.serve(async (req: Request) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== `Bearer ${NEXT_JS_SHARED_SECRET}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const url = new URL(req.url);
        const noteId = url.searchParams.get('id');
        if (!noteId) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('published_notes')
            .select('note_id, title, md_data, published_at, updated_at, user_id')
            .eq('note_id', noteId)
            .single();

        if (error || !data) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

        const ADMIN_USER_ID = '...';
        const { user_id, ...safeData } = data; 
        
        return new Response(JSON.stringify({ ...safeData, is_admin: data.user_id === ADMIN_USER_ID }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
```

## B. Database Triggers & Webhooks

### 1. Revalidation Webhook

- **Trigger:** `INSERT`, `UPDATE`, `DELETE` on `public.published_notes`.
- **Action:** Triggers a database webhook to `POST` to `https://annota.online/api/revalidate-note` to instantly refresh cached frontend content.

### 2. Publishing Limits (check_published_notes_limit)

- **Trigger:** `BEFORE INSERT` on `public.published_notes`.
- **Function:** `enforce_published_notes_limit`.
- **Logic:**
  - Verifies the user has a valid 'Pro', 'Beta', or 'Admin' role and an active subscription.
  - Enforces a hard limit of 50 published notes per user.