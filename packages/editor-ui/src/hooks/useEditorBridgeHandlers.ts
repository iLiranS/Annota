import { NoteImageService, getPlatformAdapters } from '@annota/core/platform';
import { Buffer } from 'buffer';
import { useCallback } from 'react';
import { TipTapEditorProps } from '../shared/types';

// Removed IMAGE_MIME_TO_EXT and getExtensionFromMime as per instruction to improve extension detection.
// The new approach will likely infer the extension from the base64 data itself or rely on a more robust method.
// For now, we'll assume the platform adapters or NoteImageService can handle this.
// If the original logic was to be kept, it would be:
const IMAGE_MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

function getExtensionFromMime(base64: string): string {
    const mimeMatch = base64.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if (mimeMatch) {
        return IMAGE_MIME_TO_EXT[mimeMatch[1].toLowerCase()] ?? 'png';
    }
    return 'png';
}

interface BridgeHandlersOptions extends TipTapEditorProps {
    sendMessage: (command: string, params: Record<string, any>) => void;
    isDark: boolean;
    colors: any;
    editorSettings: any;
    onReady?: () => void;
    onOpenLink?: (href: string) => void;
    onHeightChange?: (height: number) => void;
    contentResolver?: { current: ((html: string) => void) | null };
}

export function useEditorBridgeHandlers({
    sendMessage,
    noteId,
    initialContent,
    placeholder,
    autofocus,
    contentPaddingTop,
    editable,
    isDark,
    colors,
    editorSettings,
    onContentChange,
    onReady,
    onOpenLink,
    onHeightChange,
    contentResolver
}: BridgeHandlersOptions) {

    const handleBridgeMessage = useCallback(async (type: string, data: any) => {
        switch (type) {
            case 'ready':
                sendMessage('setOptions', {
                    isDark,
                    colors,
                    content: initialContent,
                    placeholder,
                    autofocus,
                    paddingTop: contentPaddingTop,
                    direction: editorSettings.direction,
                    fontFamily: editorSettings.fontFamily,
                    fontSize: editorSettings.fontSize,
                    lineSpacing: editorSettings.lineSpacing,
                    editable,
                    defaultCodeLanguage: editorSettings.defaultCodeLanguage,
                });

                onReady?.();
                break;

            case 'content':
                onContentChange?.(data.html);
                break;

            case 'contentResponse':
                if (contentResolver?.current) {
                    contentResolver.current(data.html);
                    contentResolver.current = null;
                }
                break;

            case 'heightChange':
                if (typeof data.height === 'number') {
                    onHeightChange?.(data.height);
                }
                break;

            case 'openLink':
                if (data.href) {
                    onOpenLink?.(data.href);
                }
                break;

            case 'resolveImageIds':
                if (data.imageIds && Array.isArray(data.imageIds)) {
                    try {
                        const imageMap = await NoteImageService.resolveImageSources(data.imageIds);
                        sendMessage('resolveImages', { imageMap });
                    } catch (err) {
                        console.error('Failed to resolve image IDs:', err);
                    }
                }
                break;

            case 'imagePasted':
                if (data.base64 && data.imageId && noteId) {
                    try {
                        const extension = getExtensionFromMime(data.base64);
                        const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, "");
                        const rawBytes = Buffer.from(base64Data, 'base64');
                        const adapters = getPlatformAdapters();
                        const cacheDir = await adapters.fileSystem.ensureDir('cache');
                        const tempPath = `${cacheDir}/pasted-${Date.now()}.${extension}`;
                        await adapters.fileSystem.writeBytes(tempPath, new Uint8Array(rawBytes));
                        const processed = await NoteImageService.processAndInsertImage(noteId, tempPath);
                        const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                        sendMessage('replaceImageId', {
                            oldId: data.imageId,
                            newId: processed.imageId,
                            src: imageMap[processed.imageId]
                        });
                    } catch (err) {
                        console.error('Failed to handle pasted image:', err);
                    }
                }
                break;
        }
    }, [
        sendMessage, noteId, initialContent, placeholder, autofocus,
        contentPaddingTop, editable, isDark, colors, editorSettings,
        onContentChange, onReady, onOpenLink, onHeightChange, contentResolver
    ]);

    return { handleBridgeMessage };
}
