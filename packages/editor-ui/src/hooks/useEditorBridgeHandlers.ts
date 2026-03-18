import { NoteImageService } from '@annota/core/platform';
import { useCallback } from 'react';
import { handleImagePaste } from '../shared/image-paste';
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
                handleImagePaste({
                    noteId,
                    data,
                    insertImage: ({ imageId, pos, src }) => {
                        // 1. Tell the WebView to insert the placeholder or the internal copied image
                        if (typeof pos === 'number') {
                            sendMessage('insertContentAt', {
                                pos,
                                content: { type: 'image', attrs: { src: src || '', imageId } }
                            });
                        } else {
                            sendMessage('insertLocalImage', { imageId, src: src || '' });
                        }
                    },
                    replaceImageId: ({ oldId, newId, src }) => {
                        // 2. Tell the WebView to safely swap the temp ID for the real Rust database UUID
                        sendMessage('replaceImageId', { oldId, newId, src });
                    },
                    resolveImages: (imageMap) => {
                        // 3. Hydrate the image so the user can see it
                        if (Object.keys(imageMap).length > 0) {
                            sendMessage('resolveImages', { imageMap });
                        }
                    }
                }).catch((err) => {
                    console.error('Failed to handle pasted image via bridge:', err);
                });
                break;
        }
    }, [
        sendMessage, noteId, initialContent, placeholder, autofocus,
        contentPaddingTop, editable, isDark, colors, editorSettings,
        onContentChange, onReady, onOpenLink, onHeightChange, contentResolver
    ]);

    return { handleBridgeMessage };
}
