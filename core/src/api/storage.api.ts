import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';

export const storageApi = {
    /** Upload a file to supabase storage
     * NOTE: For React Native, we pass the data as a base64 string, and then decode it into an ArrayBuffer
     * using the built-in `decode` method to ensure it's sent properly across the RN bridge.
     */
    uploadFile: async (path: string, base64Data: string, contentType: string, bucket = 'e2e_attachments') => {
        return await supabase.storage.from(bucket).upload(path, decode(base64Data), {
            contentType,
            cacheControl: '3600',
            upsert: true,
        });
    },

    /** Download a file from supabase storage */
    downloadFile: async (path: string, bucket = 'e2e_attachments') => {
        return await supabase.storage.from(bucket).download(path);
    },

    /** Execute the RPC to replace note files */
    replaceNoteFiles: async (noteId: string, newUrlFragments: string[], deviceId: string) => {
        return await supabase.rpc('replace_note_files', {
            p_note_id: noteId,
            p_new_url_fragments: newUrlFragments,
            p_device_id: deviceId
        });
    },

    /** Execute the RPC to replace e2e note files */
    replaceE2ENoteFiles: async (noteId: string, userId: string, fileIds: string[]) => {
        return await supabase.rpc('replace_note_files', {
            p_note_id: noteId,
            p_user_id: userId,
            p_file_ids: fileIds,
        });
    },

    /** Get the list of orphaned files for deletion (usually run as CRON, but available here) */
    getOrphanedFiles: async () => {
        return await supabase.rpc('get_orphaned_files_for_deletion');
    },

    /** Retrieve signed URLs or public URLs for multiple files in a batch. */
    getPublicUrl: (path: string, bucket = 'e2e_attachments') => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    },

    /** List files in a path */
    listFiles: async (path: string, bucket = 'e2e_attachments') => {
        return await supabase.storage.from(bucket).list(path);
    },

    /** Remove files */
    removeFiles: async (paths: string[], bucket = 'e2e_attachments') => {
        return await supabase.storage.from(bucket).remove(paths);
    },

    /** Retrieve user's file links used for checking missing downloads - only for updated notes */
    getUserFileLinks: async (userId: string, noteIds: string[]) => {
        if (!noteIds || noteIds.length === 0) {
            return { data: [], error: null };
        }

        return await supabase
            .from('note_files')
            .select(`
            note_id,
            file_id,
            user_id
        `)
            .eq('user_id', userId)
            .in('note_id', noteIds);
    },

    /** Fetch encrypted metadata for a specific list of file IDs */
    getEncryptedFilesMetadata: async (userId: string, fileIds: string[]) => {
        return await supabase
            .from('encrypted_files')
            .select('id, nonce')
            .in('id', fileIds)
            .eq('user_id', userId);
    },

    /** Insert a new encrypted file record */
    upsertEncryptedFile: async (id: string, userId: string, nonce: string, mimeType: string, sizeBytes: number) => {
        return await supabase
            .from('encrypted_files')
            .upsert({
                id,
                user_id: userId,
                nonce,
                mime_type: mimeType,
                size_bytes: sizeBytes,
                created_at: new Date().toISOString(),
            });
    }
};
