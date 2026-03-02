import { supabase } from '../supabase';

export const storageApi = {
    /** Upload an image to supabase storage
     * NOTE: For React Native, we pass the data as a base64 string, and then decode it into an ArrayBuffer
     * using the built-in `decode` method to ensure it's sent properly across the RN bridge.
     */
    uploadImage: async (path: string, base64Data: string, contentType: string, bucket = 'e2e_images') => {
        const { decode } = require('base64-arraybuffer');
        return await supabase.storage.from(bucket).upload(path, decode(base64Data), {
            contentType,
            cacheControl: '3600',
            upsert: true,
        });
    },

    /** Download an image from supabase storage */
    downloadImage: async (path: string, bucket = 'e2e_images') => {
        return await supabase.storage.from(bucket).download(path);
    },

    /** Update metadata for an image */
    updateImageMetadata: async (urlFragment: string, noteId: string, deviceId: string) => {
        return await supabase
            .from('image_metadata')
            .upsert({
                url_fragment: urlFragment,
                note_id: noteId,
                last_used_device_id: deviceId
            }, {
                onConflict: 'url_fragment'
            });
    },

    /** Execute the RPC to replace note images */
    replaceNoteImages: async (noteId: string, newUrlFragments: string[], deviceId: string) => {
        return await supabase.rpc('replace_note_images', {
            p_note_id: noteId,
            p_new_url_fragments: newUrlFragments,
            p_device_id: deviceId
        });
    },

    /** Execute the RPC to replace e2e note images */
    replaceE2ENoteImages: async (noteId: string, userId: string, imageIds: string[]) => {
        return await supabase.rpc('replace_note_images', {
            p_note_id: noteId,
            p_user_id: userId,
            p_image_ids: imageIds,
        });
    },

    /** Get the list of orphaned images for deletion (usually run as CRON, but available here) */
    getOrphanedImages: async () => {
        return await supabase.rpc('get_orphaned_images_for_deletion');
    },

    /** Retrieve signed URLs or public URLs for multiple images in a batch. */
    getPublicUrl: (path: string, bucket = 'e2e_images') => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    },

    /** List files in a path */
    listFiles: async (path: string, bucket = 'e2e_images') => {
        return await supabase.storage.from(bucket).list(path);
    },

    /** Remove files */
    removeFiles: async (paths: string[], bucket = 'e2e_images') => {
        return await supabase.storage.from(bucket).remove(paths);
    },

    /** Remove a metadata record */
    removeImageMetadata: async (urlFragment: string) => {
        return await supabase.from('image_metadata').delete().eq('url_fragment', urlFragment);
    },

    /** Retrieve user's image links used for checking missing downloads */
    getUserImageLinks: async (userId: string) => {
        return await supabase
            .from('note_images')
            .select(`
                image_id,
                encrypted_notes!inner(user_id)
            `)
            .eq('encrypted_notes.user_id', userId);
    },

    /** Fetch encrypted metadata for a specific list of image IDs */
    getEncryptedImagesMetadata: async (userId: string, imageIds: string[]) => {
        return await supabase
            .from('encrypted_images')
            .select('id, nonce')
            .in('id', imageIds)
            .eq('user_id', userId);
    },

    /** Insert a new encrypted image record */
    upsertEncryptedImage: async (id: string, userId: string, nonce: string) => {
        return await supabase
            .from('encrypted_images')
            .upsert({
                id,
                user_id: userId,
                nonce,
                created_at: new Date().toISOString(),
            });
    }
};
