import { useSettingsStore } from '@annota/core';
import { NoteImageService } from '@annota/core/platform';
import editorHtml from '@annota/editor-web/dist/editor-html';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorState, ImageInfo, initialEditorState, TipTapEditorProps, TipTapEditorRef } from './types';

/** Extract data-image-id values from HTML string */
function extractImageIds(html: string): string[] {
    const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[2]);
    }
    return ids;
}

// Generic values for desktop web implementation - can be enhanced later.
const TipTapEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>(
    ({
        initialContent = '',
        onContentChange,
        placeholder = 'Start typing...',
        autofocus = false,
        onSearchResults,
        contentPaddingTop = 0,
        onGalleryVisibilityChange,
        editable = true,
        noteId,
        onCopyBlockLink,
        renderToolbar,
        renderImageGallery,
        isDark: propIsDark,
        colors: propColors,
    }, ref) => {
        // Use props for theme, falling back to defaults if not provided (though desktop should provide them)
        const colors = propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' };
        const dark = propIsDark ?? false;
        const { editor: editorSettings } = useSettingsStore();

        const iframeRef = useRef<HTMLIFrameElement>(null);
        const [isReady, setIsReady] = useState(false);
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [isGalleryVisible, setIsGalleryVisible] = useState(false);
        const [galleryImages, setGalleryImages] = useState<ImageInfo[]>([]);
        const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
        const isReadyRef = useRef(false);
        const queuedCommandsRef = useRef<Array<{ command: string; params: Record<string, unknown> }>>([]);
        const contentResolverRef = useRef<((html: string) => void) | null>(null);
        const hasWrittenRef = useRef(false);

        useEffect(() => {
            // Only write to the iframe once, even in React Strict Mode
            if (iframeRef.current && !hasWrittenRef.current) {
                hasWrittenRef.current = true;
                const doc = iframeRef.current.contentDocument;
                if (doc) {
                    doc.open();
                    doc.write(editorHtml);
                    // Inject a script to catch clicks/interactions inside the iframe and report them to the parent.
                    // This allows the parent's dropdowns (like in the toolbar) to close when the editor is clicked.
                    doc.write(`
                        <script>
                            document.addEventListener('mousedown', () => {
                                window.parent.postMessage({ type: 'interact' }, '*');
                            }, { capture: true });
                        </script>
                    `);
                    doc.close();
                }
            }
        }, [editorHtml]);

        const injectCommand = useCallback((command: string, params: Record<string, unknown> = {}) => {
            if (!iframeRef.current?.contentWindow) return;
            try {
                const targetWindow = iframeRef.current.contentWindow as any;
                if (typeof targetWindow.handleCommand === 'function') {
                    targetWindow.handleCommand(command, params);
                } else {
                    console.warn('handleCommand not found on iframe window yet for command:', command);
                }
            } catch (e) {
                console.error('Failed to execute command on iframe:', e);
            }
        }, []);

        const flushQueuedCommands = useCallback(() => {
            if (!isReadyRef.current || queuedCommandsRef.current.length === 0) return;
            const pending = queuedCommandsRef.current;
            queuedCommandsRef.current = [];
            pending.forEach(({ command, params }) => {
                injectCommand(command, params);
            });
        }, [injectCommand]);

        const sendCommand = useCallback(
            (command: string, params: Record<string, unknown> = {}) => {
                if (!iframeRef.current) return;

                if (!isReadyRef.current && command !== 'setOptions') {
                    queuedCommandsRef.current.push({ command, params });
                    return;
                }

                injectCommand(command, params);
            },
            [injectCommand]
        );

        useImperativeHandle(
            ref,
            () => ({
                getContent: () => {
                    return new Promise((resolve) => {
                        contentResolverRef.current = resolve;
                        sendCommand('getContent');
                        setTimeout(() => {
                            if (contentResolverRef.current) {
                                contentResolverRef.current('');
                                contentResolverRef.current = null;
                            }
                        }, 1000);
                    });
                },
                setContent: (content: string) => {
                    sendCommand('setContent', { content });
                },
                focus: () => sendCommand('focus'),
                blur: () => sendCommand('blur'),
                search: (term: string) => sendCommand('search', { term }),
                searchNext: () => sendCommand('searchNext'),
                searchPrev: () => sendCommand('searchPrev'),
                clearSearch: () => sendCommand('clearSearch'),
                scrollToElement: (id: string) => sendCommand('scrollToElement', { id }),
            }),
            [sendCommand]
        );

        const handleMessage = useCallback((event: MessageEvent) => {
            try {
                // Ignore empty messages or browser extension noise
                if (!event.data) return;

                let data;
                if (typeof event.data === 'string') {
                    try {
                        data = JSON.parse(event.data);
                    } catch {
                        return; // Ignore non-JSON strings
                    }
                } else {
                    data = event.data;
                }

                console.log("Desktop Bridge Received Event Type:", data?.type);

                switch (data.type) {
                    case 'ready':
                        isReadyRef.current = true;
                        setIsReady(true);
                        sendCommand('setOptions', {
                            isDark: dark,
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
                        });

                        // --- ADD THIS MISSING BLOCK ---
                        // Resolve any local images in the initial content
                        const imageIds = extractImageIds(initialContent);
                        if (imageIds.length > 0) {
                            NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                                console.log("INITIAL LOAD: NoteImageService found:", imageMap);
                                if (Object.keys(imageMap).length > 0) {
                                    sendCommand('resolveImages', { imageMap });
                                }
                            });
                        }
                        // ------------------------------

                        flushQueuedCommands();
                        break;
                    case 'content':
                        onContentChange?.(data.html);
                        break;
                    case 'contentResponse':
                        if (contentResolverRef.current) {
                            contentResolverRef.current(data.html);
                            contentResolverRef.current = null;
                        }
                        break;
                    case 'state':
                        setEditorState(data.state);
                        break;
                    case 'resolveImageIds':
                        if (Array.isArray(data.imageIds) && data.imageIds.length > 0) {
                            (async () => {
                                try {
                                    console.log("1. TipTap is asking for Image IDs:", data.imageIds);

                                    const imageMap = await NoteImageService.resolveImageSources(data.imageIds);

                                    console.log("2. NoteImageService found:", imageMap);

                                    if (Object.keys(imageMap).length > 0) {
                                        sendCommand('resolveImages', { imageMap });
                                    } else {
                                        console.warn("3. ABORTED: NoteImageService returned empty map for IDs:", data.imageIds);
                                    }
                                } catch (err) {
                                    console.error('Failed to resolve image IDs on desktop:', err);
                                }
                            })();
                        }
                        break;
                    case 'interact':
                        // Dispatch simulated events on the parent document to trigger Radix UI's outside click dismissal.
                        const eventProps = { bubbles: true, cancelable: true };
                        document.dispatchEvent(new PointerEvent('pointerdown', eventProps));
                        document.dispatchEvent(new MouseEvent('mousedown', eventProps));
                        document.dispatchEvent(new FocusEvent('focusin', eventProps));

                        // If any element in the parent window currently has focus (like a button in the toolbar)
                        // blurring it can help trigger the closing of menus.
                        if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
                            document.activeElement.blur();
                        }
                        break;
                    case 'imageSelected':
                        setGalleryImages(data.images || []);
                        setGalleryCurrentIndex(data.currentIndex || 0);
                        setIsGalleryVisible(true);
                        onGalleryVisibilityChange?.(true);
                        break;
                    case 'imagePasted':
                        if (data.base64 && data.imageId && noteId) {
                            (async () => {
                                try {
                                    const processed = await NoteImageService.processAndInsertImage(noteId, data.base64);
                                    sendCommand('replaceImageId', { oldId: data.imageId, newId: processed.imageId });
                                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                                    sendCommand('resolveImages', { imageMap });
                                } catch (err) {
                                    console.error('Failed to handle pasted image on desktop:', err);
                                }
                            })();
                        }
                        break;
                }
            } catch (e) {
                // ignore
            }
        }, [dark, colors, initialContent, placeholder, autofocus, contentPaddingTop, editorSettings, editable, sendCommand, flushQueuedCommands, onContentChange, noteId]);

        useEffect(() => {
            if (isReady) {
                sendCommand('setOptions', {
                    isDark: dark,
                    colors,
                    paddingTop: contentPaddingTop,
                    direction: editorSettings.direction,
                    fontFamily: editorSettings.fontFamily,
                    fontSize: editorSettings.fontSize,
                    lineSpacing: editorSettings.lineSpacing,
                });
            }
        }, [dark, colors, isReady, sendCommand, contentPaddingTop, editorSettings]);

        useEffect(() => {
            window.addEventListener('message', handleMessage);
            return () => window.removeEventListener('message', handleMessage);
        }, [handleMessage]);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', width: '100%', position: 'relative', }}>
                {renderToolbar?.({
                    editorState,
                    sendCommand,
                    toolbarHeight: 0, // Not used much on desktop yet
                    onDismissKeyboard: () => { },
                    activePopup: null,
                    onActivePopupChange: () => { },
                    onPopupStateChange: () => { },
                    onInsertImage: async () => false,
                    currentLatex: null,
                    blockData: null,
                    onInsertMath: () => { }
                })}

                <iframe
                    ref={iframeRef}
                    style={{
                        flex: 1,
                        border: 'none',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'transparent',
                        minHeight: 0 // Crucial for flexbox scrolling inside iframe
                    }}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    title="TipTap Editor"
                />

                {renderImageGallery?.({
                    images: galleryImages,
                    initialIndex: galleryCurrentIndex,
                    visible: isGalleryVisible,
                    onClose: () => {
                        setIsGalleryVisible(false);
                        onGalleryVisibilityChange?.(false);
                    }
                })}
            </div>
        );
    }
));

TipTapEditor.displayName = 'TipTapEditor';

export default TipTapEditor;
export type { TipTapEditorProps, TipTapEditorRef, ToolbarRenderProps } from './types';
export { TipTapEditor };

