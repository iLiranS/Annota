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


    /** Execute the RPC to replace e2e note files */
    replaceE2ENoteFiles: async (noteId: string, userId: string, fileIds: string[]) => {
        return await supabase.rpc('replace_note_files', {
            p_note_id: noteId,
            p_user_id: userId,
            p_file_ids: fileIds,
        });
    },



    /** Retrieve user's file links used for checking missing downloads - only for notes that we just fetched ! */
    /* I was thinking on adding to supabase note_files updated_At but we hard replace them, so it's an headache to maintain */
    getUserFileLinks: async (userId: string, noteIds: string[]) => {
        if (!noteIds || noteIds.length === 0) {
            return { data: [], error: null };
        }

        const CHUNK_SIZE = 100;
        let allData: any[] = [];

        for (let i = 0; i < noteIds.length; i += CHUNK_SIZE) {
            const chunk = noteIds.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from('note_files')
                .select(`
                note_id,
                file_id,
                user_id
            `)
                .eq('user_id', userId)
                .in('note_id', chunk);

            if (error) return { data: null, error };
            if (data) allData = allData.concat(data);
        }

        return { data: allData, error: null };
    },

    /** Fetch encrypted metadata for a specific list of file IDs */
    getEncryptedFilesMetadata: async (userId: string, fileIds: string[]) => {
        if (!fileIds || fileIds.length === 0) return { data: [], error: null };

        const CHUNK_SIZE = 100;
        let allData: any[] = [];

        for (let i = 0; i < fileIds.length; i += CHUNK_SIZE) {
            const chunk = fileIds.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from('encrypted_files')
                .select('id, nonce')
                .in('id', chunk)
                .eq('user_id', userId);

            if (error) return { data: null, error };
            if (data) allData = allData.concat(data);
        }

        return { data: allData, error: null };
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
