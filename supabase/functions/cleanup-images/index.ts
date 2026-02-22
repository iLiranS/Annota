import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * What the Function Checks For
 * The get_orphaned_images_for_deletion RPC flags an image as an orphan only if both of these conditions are true:
 * - The image exists in the encrypted_images table but has no matching row in the note_images table.
 * - The image is older than 24 hours (i.created_at < now() - interval '24 hours').
 */

Deno.serve(async (req: Request) => {
    try {
        // 1. Fetch orphaned images using the RPC we created
        const { data: filesToDelete, error: sqlError } = await supabase.rpc('get_orphaned_images_for_deletion');

        if (sqlError) throw sqlError;

        // 2. Exit early if nothing to clean up
        if (!filesToDelete || filesToDelete.length === 0) {
            return new Response(JSON.stringify({ message: 'No orphans found' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        }

        console.log(`Found ${filesToDelete.length} orphans.`);

        // 3. Prepare paths and delete from Storage Bucket
        const pathsToDelete = filesToDelete.map((img: { id: string, user_id: string }) => `${img.user_id}/${img.id}`);
        const { error: storageError } = await supabase
            .storage
            .from('e2e_images')
            .remove(pathsToDelete);

        if (storageError) throw storageError;

        // 4. Delete the metadata rows from the database
        const idsToDelete = filesToDelete.map((img: { id: string }) => img.id);
        const { error: dbError } = await supabase
            .from('encrypted_images')
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