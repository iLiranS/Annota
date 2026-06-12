import { File as ExpoFile, Paths } from 'expo-file-system';
import editorHtml from '@annota/editor-core/dist/editor-html';

export const EDITOR_CACHE_FILENAME = `editor_${editorHtml.length}.html`;
export const editorCacheFile = new ExpoFile(Paths.cache, EDITOR_CACHE_FILENAME);

let isEditorHtmlCached = false;

export const ensureEditorHtmlCache = async (): Promise<string> => {
    if (isEditorHtmlCached) {
        return editorCacheFile.uri;
    }
    try {
        const exists = editorCacheFile.exists;
        const size = exists ? (await editorCacheFile.size) : 0;

        // 1. Write the new version if it doesn't exist or is corrupted/empty
        if (!exists || size < 1024 * 1024) {
            await editorCacheFile.write(editorHtml);
        }
        isEditorHtmlCached = true;

        // 2. Scan and delete old cached HTML files to avoid storage accumulation
        const parentDir = Paths.cache;
        if (parentDir.exists) {
            const contents = parentDir.list();
            for (const item of contents) {
                if (
                    item instanceof ExpoFile &&
                    item.name.startsWith('editor_') &&
                    item.name.endsWith('.html') &&
                    item.name !== EDITOR_CACHE_FILENAME
                ) {
                    try {
                        await item.delete();
                        console.log(`[EditorHtmlCache] Cleaned up old cache file: ${item.name}`);
                    } catch (err) {
                        console.warn('[EditorHtmlCache] Failed to delete old cache file:', item.name, err);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[EditorHtmlCache] Failed to cache editor HTML:', e);
    }
    return editorCacheFile.uri;
};

export const getIsEditorHtmlCached = () => isEditorHtmlCached;

export const webViewSourceFallback = { html: editorHtml, baseUrl: 'https://app.local' };

