import { useSettingsStore } from '@annota/core';
import { getPlatformAdapters, NoteImageService } from '@annota/core/platform';
import editorHtml from '@annota/editor-web/dist/editor-html';
import { Buffer } from 'buffer';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorState, ImageInfo, initialEditorState, PopupType, TipTapEditorProps, TipTapEditorRef } from './types';

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

export const IframeEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>(
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
        renderToolbar,
        renderImageGallery,
        onSlashCommand,
        onTagCommand,
        isDark: propIsDark,
        colors: propColors,
    }, ref) => {
        const colors = propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' };
        const dark = propIsDark ?? false;
        const { editor: editorSettings } = useSettingsStore();

        const iframeRef = useRef<HTMLIFrameElement>(null);
        const [isReady, setIsReady] = useState(false);
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [isGalleryVisible, setIsGalleryVisible] = useState(false);
        const [galleryImages, setGalleryImages] = useState<ImageInfo[]>([]);
        const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const [tempBlockData, setTempBlockData] = useState<any>(null);
        const isReadyRef = useRef(false);
        const queuedCommandsRef = useRef<Array<{ command: string; params: Record<string, unknown> }>>([]);
        const contentResolverRef = useRef<((html: string) => void) | null>(null);
        const hasWrittenRef = useRef(false);

        useEffect(() => {
            if (iframeRef.current && !hasWrittenRef.current) {
                hasWrittenRef.current = true;
                const doc = iframeRef.current.contentDocument;
                if (doc) {
                    doc.open();
                    doc.write(editorHtml);
                    doc.write(`
                        <script>
                            document.addEventListener('mousedown', () => {
                                window.parent.postMessage({ type: 'interact' }, '*');
                            }, { capture: true });
                            document.addEventListener('mouseenter', () => {
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
                // Handle UI commands locally
                switch (command) {
                    case 'openMathModal':
                        setCurrentLatex(null);
                        setActivePopup('math');
                        return;
                    case 'openImageModal':
                        setActivePopup('image');
                        return;
                    case 'openLinkModal':
                        setActivePopup('link');
                        return;
                    case 'openYoutubeModal':
                        setActivePopup('youtube');
                        return;
                }

                if (!iframeRef.current) return;

                if (!isReadyRef.current && command !== 'setOptions') {
                    queuedCommandsRef.current.push({ command, params });
                    return;
                }

                injectCommand(command, params);
            },
            [injectCommand, isReadyRef, queuedCommandsRef]
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
                onCommand: (cmd: string, params?: Record<string, unknown>) => sendCommand(cmd, params),
                search: (term: string) => sendCommand('search', { term }),
                searchNext: () => sendCommand('searchNext'),
                searchPrev: () => sendCommand('searchPrev'),
                clearSearch: () => sendCommand('clearSearch'),
                scrollToElement: (id: string) => sendCommand('scrollToElement', { id }),
            }),
            [sendCommand, contentResolverRef]
        );

        const handleMessage = useCallback((event: MessageEvent) => {
            try {
                if (!event.data) return;
                let data;
                if (typeof event.data === 'string') {
                    try {
                        data = JSON.parse(event.data);
                    } catch { return; }
                } else {
                    data = event.data;
                }

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
                            noteWidth: editorSettings.noteWidth,
                            editable,
                        });
                        const imageIds = extractImageIds(initialContent);
                        if (imageIds.length > 0) {
                            NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                                if (Object.keys(imageMap).length > 0) {
                                    sendCommand('resolveImages', { imageMap });
                                }
                            });
                        }
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
                                    const imageMap = await NoteImageService.resolveImageSources(data.imageIds);
                                    if (Object.keys(imageMap).length > 0) {
                                        sendCommand('resolveImages', { imageMap });
                                    }
                                } catch (err) {
                                    console.error('Failed to resolve image IDs on desktop:', err);
                                }
                            })();
                        }
                        break;
                    case 'interact':
                        const eventProps = { bubbles: true, cancelable: true };
                        document.body.dispatchEvent(new PointerEvent('pointerdown', eventProps));
                        document.body.dispatchEvent(new MouseEvent('mousedown', eventProps));
                        document.body.dispatchEvent(new PointerEvent('pointermove', {
                            ...eventProps,
                            clientX: -1,
                            clientY: -1,
                        }));
                        document.querySelectorAll('[data-slot="tooltip-trigger"]').forEach((el) => {
                            el.dispatchEvent(new PointerEvent('pointerleave', { ...eventProps }));
                        });
                        break;
                    case 'searchResults':
                        onSearchResults?.(data.count, data.currentIndex);
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
                                    const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, "");
                                    const rawBytes = Buffer.from(base64Data, 'base64');

                                    const adapters = getPlatformAdapters();
                                    const cacheDir = await adapters.fileSystem.ensureDir('cache');
                                    const mimeMatch = data.base64.match(/^data:(image\/\w+);base64,/);
                                    const ext = (mimeMatch ? mimeMatch[1] : 'image/png').split('/').pop() || 'png';
                                    const tempFilename = `pasted-${Date.now()}.${ext}`;
                                    const sep = cacheDir.includes('\\') ? '\\' : '/';
                                    const tempPath = `${cacheDir}${cacheDir.endsWith(sep) ? '' : sep}${tempFilename}`;

                                    await adapters.fileSystem.writeBytes(tempPath, new Uint8Array(rawBytes));
                                    const processed = await NoteImageService.processAndInsertImage(noteId, tempPath);

                                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                                    sendCommand('replaceImageId', {
                                        oldId: data.imageId,
                                        newId: processed.imageId,
                                        src: imageMap[processed.imageId]
                                    });

                                    await adapters.fileSystem.deleteFile(tempPath).catch(() => { });
                                } catch (err) {
                                    console.error('Failed to handle pasted image on desktop:', err);
                                }
                            })();
                        }
                        break;
                    case 'slashCommand':
                        onSlashCommand?.(data);
                        break;
                    case 'tagCommand':
                        onTagCommand?.(data);
                        break;
                    case 'mathSelected':
                        setCurrentLatex(data.latex);
                        setActivePopup('math');
                        break;
                    case 'openBlockMenu':
                    case 'openImageMenu':
                    case 'openTableMenu':
                    case 'codeBlockSelected':
                        setTempBlockData(data);
                        setActivePopup(data.type === 'codeBlockSelected' ? 'codeLanguage' : (data.type === 'openImageMenu' ? 'imageMenu' : 'blockMenu'));
                        break;
                }
            } catch (e) { /* ignore */ }
        }, [dark, colors, initialContent, placeholder, autofocus, contentPaddingTop, editorSettings, editable, sendCommand, flushQueuedCommands, onContentChange, noteId, onSlashCommand, contentResolverRef, setActivePopup, setCurrentLatex, setTempBlockData, setIsReady]);

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
                    noteWidth: editorSettings.noteWidth,
                });
            }
        }, [dark, colors, isReady, sendCommand, contentPaddingTop, editorSettings]);

        useEffect(() => {
            if (isReady && initialContent !== undefined) {
                sendCommand('setContent', { content: initialContent });
                const imageIds = extractImageIds(initialContent);
                if (imageIds.length > 0) {
                    NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                        if (Object.keys(imageMap).length > 0) {
                            sendCommand('resolveImages', { imageMap });
                        }
                    });
                }
            }
        }, [initialContent, isReady, sendCommand]);

        useEffect(() => {
            window.addEventListener('message', handleMessage);
            return () => window.removeEventListener('message', handleMessage);
        }, [handleMessage]);

        const handleInsertImage = useCallback(async (source: 'url' | 'library' | 'camera', value?: string): Promise<boolean> => {
            if (!noteId) return false;
            try {
                if (source === 'url' && value) {
                    const processed = await NoteImageService.processRemoteImage(noteId, value);
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    sendCommand('insertLocalImage', {
                        imageId: processed.imageId,
                        src: imageMap[processed.imageId]
                    });
                    return true;
                } else if (source === 'library' && value) {
                    const processed = await NoteImageService.processAndInsertImage(noteId, value);
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    sendCommand('insertLocalImage', {
                        imageId: processed.imageId,
                        src: imageMap[processed.imageId]
                    });
                    return true;
                }
                return false;
            } catch (err) {
                console.error('Failed to insert image:', err);
                return false;
            }
        }, [noteId, sendCommand]);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', width: '100%', position: 'relative', }}>
                {renderToolbar?.({
                    editorState,
                    sendCommand,
                    onCommand: sendCommand,
                    toolbarHeight: 0,
                    onDismissKeyboard: () => { },
                    activePopup,
                    onActivePopupChange: setActivePopup,
                    onPopupStateChange: (isOpen) => { if (!isOpen) setActivePopup(null); },
                    onInsertImage: handleInsertImage,
                    currentLatex,
                    blockData: tempBlockData,
                    onInsertMath: () => {
                        setCurrentLatex(null);
                        setActivePopup('math');
                    }
                })}

                <iframe
                    ref={iframeRef}
                    style={{ flex: 1, border: 'none', width: '100%', height: '100%', backgroundColor: 'transparent', minHeight: 0 }}
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
                    },
                    onNavigate: (index: number) => setGalleryCurrentIndex(index)
                })}
            </div>
        );
    }
));
