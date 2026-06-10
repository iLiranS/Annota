import { useSettingsStore } from '@annota/core';
import { NoteFileService } from '@annota/core/platform';
import { dispatchEditorCommand, getBaseExtensions, getEditorState, getExtensions, getPlainTextFromFragment, prepareMarksHTMLForClipboard } from '@annota/editor-core';
import '@annota/editor-core/highlight-theme.css';
import '@annota/editor-core/styles.css';
import { DOMSerializer } from '@tiptap/pm/model';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useContextMenuLinkInterceptor } from './hooks/useContextMenuLinkInterceptor';
import { useDesktopEditorProps } from './hooks/useDesktopEditorProps';
import { useEditorKeyboardShortcuts } from './hooks/useEditorKeyboardShortcuts';
import { useEditorThemeVariables } from './hooks/useEditorThemeVariables';
import { useGlobalPasteHandler } from './hooks/useGlobalPasteHandler';
import { useSharedEditorUI } from './hooks/useSharedEditorUI';
import { DESKTOP_SELECTION_STYLES } from './shared/desktopSelectionStyles';
import { insertProcessedFile, insertRemoteFile } from './shared/file-insert-utils';
import { extractImageIds } from './shared/image-utils';
import { EditorState, initialEditorState, PopupType, TipTapEditorProps, TipTapEditorRef } from './shared/types';

export const EditorDom = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>(
    ({
        initialContent = '',
        onContentChange,
        contentPaddingTop = 0,
        placeholder = 'Start typing...',
        autofocus = false,
        onSearchResults,
        onGalleryVisibilityChange,
        editable = true,
        noteId,
        onOpenBlockMenu,
        onOpenFileMenu,
        onOpenTableMenu,
        onCodeBlockSelected,
        onSlashCommand,
        onTagCommand,
        onNoteLinkCommand,
        onOpenLinkMenu,
        onSelectionChange,
        renderToolbar,
        renderHeader,
        renderStaticHeader,
        renderImageGallery,
        isDark: propIsDark,
        colors: propColors,
        direction: propDirection,
        onScroll,
        onCopyBlockLink,
    }, ref) => {
        const colors = useMemo(() => propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' }, [propColors]);
        const dark = propIsDark ?? false;
        const editorSettings = useSettingsStore(s => s.editor);
        const direction = propDirection || editorSettings.direction;
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const [isBlockMath, setIsBlockMath] = useState<boolean>(false);
        const { gallery, openGallery, closeGallery, setGalleryIndex } = useSharedEditorUI(onGalleryVisibilityChange);
        const containerRef = useRef<HTMLDivElement>(null);
        const scrollerRef = useRef<HTMLDivElement>(null);
        const isHydrating = useRef(false);
        const editorRef = useRef<any>(null);
        // Content debounce: mirrors mobile's editor-core.ts pattern (300ms there, 750ms here)
        const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const pendingHtmlRef = useRef<string | null>(null);
        const onContentChangeRef = useRef(onContentChange);
        useEffect(() => { onContentChangeRef.current = onContentChange; }, [onContentChange]);
        // Use a ref so the contextmenu handler always calls the latest callback (avoids stale closure)
        const onOpenLinkMenuRef = useRef(onOpenLinkMenu);
        useEffect(() => { onOpenLinkMenuRef.current = onOpenLinkMenu; }, [onOpenLinkMenu]);
        const onOpenTableMenuRef = useRef(onOpenTableMenu);
        useEffect(() => { onOpenTableMenuRef.current = onOpenTableMenu; }, [onOpenTableMenu]);
        const onSearchResultsRef = useRef(onSearchResults);
        useEffect(() => { onSearchResultsRef.current = onSearchResults; }, [onSearchResults]);
        const onOpenBlockMenuRef = useRef(onOpenBlockMenu);
        useEffect(() => { onOpenBlockMenuRef.current = onOpenBlockMenu; }, [onOpenBlockMenu]);
        const onOpenFileMenuRef = useRef(onOpenFileMenu);
        useEffect(() => { onOpenFileMenuRef.current = onOpenFileMenu; }, [onOpenFileMenu]);
        const onCodeBlockSelectedRef = useRef(onCodeBlockSelected);
        useEffect(() => { onCodeBlockSelectedRef.current = onCodeBlockSelected; }, [onCodeBlockSelected]);
        const onSlashCommandRef = useRef(onSlashCommand);
        useEffect(() => { onSlashCommandRef.current = onSlashCommand; }, [onSlashCommand]);
        const onTagCommandRef = useRef(onTagCommand);
        useEffect(() => { onTagCommandRef.current = onTagCommand; }, [onTagCommand]);
        const onNoteLinkCommandRef = useRef(onNoteLinkCommand);
        useEffect(() => { onNoteLinkCommandRef.current = onNoteLinkCommand; }, [onNoteLinkCommand]);
        const onGalleryVisibilityChangeRef = useRef(onGalleryVisibilityChange);
        useEffect(() => { onGalleryVisibilityChangeRef.current = onGalleryVisibilityChange; }, [onGalleryVisibilityChange]);
        const handleCommandRef = useRef<any>(null);
        const openGalleryRef = useRef(openGallery);
        useEffect(() => { openGalleryRef.current = openGallery; }, [openGallery]);
        const noteIdRef = useRef(noteId);
        useEffect(() => { noteIdRef.current = noteId; }, [noteId]);
        const onCopyBlockLinkRef = useRef(onCopyBlockLink);
        useEffect(() => { onCopyBlockLinkRef.current = onCopyBlockLink; }, [onCopyBlockLink]);

        const [extensions, setExtensions] = useState<any[]>(() => getBaseExtensions({ placeholder }));


        const editorProps = useDesktopEditorProps({
            direction,
            editorSettings,
            editorRef,
            onOpenLinkMenuRef,
            onOpenBlockMenuRef,
            onOpenTableMenuRef,
        });


        const editor = useEditor({
            editable,
            content: initialContent,
            extensions: (extensions || []) as any,
            editorProps: editorProps as any,
            onCreate: ({ editor }) => {
                editorRef.current = editor;
                isHydrating.current = true;

                if (editor.isEmpty && editable) {
                    const chain = editor.chain();
                    chain
                        .toggleHeading({ level: 2 })
                        .insertContentAt(editor.state.doc.content.size, '<p></p>')
                        .setTextSelection(1);

                    if (autofocus) chain.focus();
                    chain.run();
                } else if (autofocus) {
                    editor.commands.focus('end');
                }

                setEditorState(getEditorState(editor) as unknown as EditorState);

                // 2. BLINDFOLD OFF: Re-enable updates after the DOM settles
                setTimeout(() => {
                    isHydrating.current = false;
                }, 50);
            },
            onUpdate: ({ editor }) => {
                if (isHydrating.current) return;
                setEditorState(getEditorState(editor) as unknown as EditorState);

                // Debounce content change to prevent per-keystroke DB writes.
                // Same pattern as mobile's editor-core.ts (line 382-388).
                // The editor UI stays responsive because TipTap manages its own DOM state.
                if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
                pendingHtmlRef.current = 'pending'; // mark that a flush is needed
                contentDebounceRef.current = setTimeout(() => {
                    if (editor.isDestroyed) return;
                    const html = editor.getHTML();
                    pendingHtmlRef.current = null;
                    onContentChangeRef.current?.(html);
                }, 750);
            },
            onSelectionUpdate: ({ editor }) => {
                const { selection } = editor.state;
                let latex = '';
                let isBlock = false;

                // Extract latex if we clicked on a math node, or extract highlighted text
                if ((selection as any).node?.type.name === 'inlineMath') {
                    latex = (selection as any).node.attrs.latex;
                    isBlock = false;
                } else if ((selection as any).node?.type.name === 'blockMath') {
                    latex = (selection as any).node.attrs.latex;
                    isBlock = true;
                } else if (!selection.empty) {
                    latex = getPlainTextFromFragment(selection.content());
                }

                setCurrentLatex(latex || null);
                setIsBlockMath(isBlock);
                setEditorState(getEditorState(editor) as unknown as EditorState);

                if (onSelectionChange) {
                    let rect: DOMRect | null = null;
                    if (!selection.empty) {
                        try {
                            const { view } = editor;
                            const head = view.coordsAtPos(selection.head);
                            rect = new DOMRect(
                                head.left,
                                head.top,
                                head.right - head.left,
                                head.bottom - head.top
                            );
                        } catch (e) { }
                    }
                    onSelectionChange({
                        empty: selection.empty,
                        range: { from: selection.from, to: selection.to },
                        clientRect: rect,
                        text: getPlainTextFromFragment(selection.content()),
                        nodeName: (selection as any).node?.type.name
                    });
                }
            },
            onTransaction: ({ editor }) => {
                setEditorState(getEditorState(editor) as unknown as EditorState);
            },
        }, [noteId, extensions]);

        // Safety net: flush pending content on unmount or noteId change.
        // Must run BEFORE useEditor's cleanup destroys the editor instance.
        useEffect(() => {
            return () => {
                if (contentDebounceRef.current) {
                    clearTimeout(contentDebounceRef.current);
                    contentDebounceRef.current = null;
                }
                if (pendingHtmlRef.current && editorRef.current && !editorRef.current.isDestroyed) {
                    const html = editorRef.current.getHTML();
                    pendingHtmlRef.current = null;
                    onContentChangeRef.current?.(html);
                }
            };
        }, [noteId]);

        // Update editor options when they change
        useEffect(() => {
            if (editor && !editor.isDestroyed) {
                editor.setOptions({
                    editorProps: editorProps as any,
                });

                // Also update DOM attributes directly for immediate effect
                const dom = editor.view.dom;
                if (dom) {
                    dom.setAttribute('spellcheck', editorSettings.spellcheck ? 'true' : 'false');
                    dom.setAttribute('autocorrect', editorSettings.autocorrect ? 'on' : 'off');
                    dom.setAttribute('autocapitalize', editorSettings.autocapitalize ? 'on' : 'off');
                    dom.setAttribute('autocomplete', editorSettings.autocomplete ? 'on' : 'off');
                }

                // Update settings window object and dispatch event for code block view
                (window as any).editorSettings = {
                    numberedLines: editorSettings.numberedLines !== undefined ? editorSettings.numberedLines : true,
                };
                window.dispatchEvent(new CustomEvent('annota-settings-change', { detail: (window as any).editorSettings }));

                // Dynamically update the codeBlock default language
                const extension = editor.extensionManager.extensions.find((e: any) => e.name === 'codeBlock');
                if (extension) {
                    (editor as any).setOptions('codeBlock', {
                        defaultLanguage: editorSettings.defaultCodeLanguage
                    });
                }

                // Dynamically update the dragHandle placement configuration
                const dragHandle = editor.extensionManager.extensions.find((e: any) => e.name === 'dragHandle');
                if (dragHandle) {
                    (editor as any).setOptions('dragHandle', {
                        computePositionConfig: {
                            placement: direction === 'rtl' ? 'right-start' : 'left-start',
                            strategy: 'absolute',
                        }
                    });
                }
            }
        }, [editor, editorProps, editorSettings, direction]);


        useEditorThemeVariables({ colors, dark, editorSettings, rootRef: containerRef });

        useContextMenuLinkInterceptor({
            containerRef,
            editorRef,
            onOpenLinkMenuRef,
        });

        useEditorKeyboardShortcuts({
            editor,
            setCurrentLatex,
            setIsBlockMath,
            setActivePopup,
        });

        // Inside Editor.dom.tsx
        const handleCommand = useCallback(async (cmd: string, params?: any) => {
            // Intercept UI commands and open popups
            if (['openMathModal', 'openFileModal', 'openLinkModal', 'openYoutubeModal'].includes(cmd)) {
                switch (cmd) {
                    case 'openMathModal': setCurrentLatex(null); setIsBlockMath(false); setActivePopup('math'); return;
                    case 'openFileModal': setActivePopup('file'); return;
                    case 'openLinkModal': setActivePopup('link'); return;
                    case 'openYoutubeModal': setActivePopup('youtube'); return;
                }
            }

            if (cmd === 'openFile') {
                (async () => {
                    const { FileService, getPlatformAdapters } = await import('@annota/core/platform');
                    const absoluteUri = await FileService.resolveLocalUri(params.localPath);
                    await getPlatformAdapters().fileSystem.openFile(absoluteUri, params.mimeType);
                })();
                return;
            }

            if (cmd === 'copyBlockLink') {
                if (params?.id && onCopyBlockLinkRef.current) {
                    onCopyBlockLinkRef.current(params.id);
                }
                return;
            }

            // Otherwise, dispatch to TipTap
            if (editor && !editor.isDestroyed) await dispatchEditorCommand(editor as any, cmd, params || {});
        }, [editor]);
        handleCommandRef.current = handleCommand;

        useEffect(() => {
            let isMounted = true;
            getExtensions({
                placeholder,
                onMathSelected: (latex, isBlock) => {
                    setCurrentLatex(latex);
                    setIsBlockMath(isBlock);
                    setActivePopup('math');
                },
                onOpenFile: (data) => handleCommandRef.current?.('openFile', data),
                onSearchResults: (count, index) => onSearchResultsRef.current?.(count, index),
                onOpenBlockMenu: (e, res) => onOpenBlockMenuRef.current?.(e, res),
                onOpenFileMenu: (e, res) => onOpenFileMenuRef.current?.(e, res),
                onOpenTableMenu: (e, res) => onOpenTableMenuRef.current?.(e, res),
                onCodeBlockSelected: (e, res) => onCodeBlockSelectedRef.current?.(e, res),
                onSlashCommand: (data) => onSlashCommandRef.current?.(data),
                onTagCommand: (data) => onTagCommandRef.current?.(data),
                onNoteLinkCommand: (data) => onNoteLinkCommandRef.current?.(data),
                onImageSelected: (data) => {
                    // Drop focus so the cursor doesn't blink behind the dark overlay
                    if (editorRef.current && !editorRef.current.isDestroyed) {
                        editorRef.current.commands.blur();
                    }
                    openGalleryRef.current?.(data.images, data.currentIndex);
                },
                onResolveImageIds: (data) => {
                    if (data.imageIds.length > 0) {
                        NoteFileService.resolveFileSources(data.imageIds).then((fileMap) => {
                            if (editorRef.current && !editorRef.current.isDestroyed && Object.keys(fileMap).length > 0) {
                                isHydrating.current = true;
                                (editorRef.current.commands as any).resolveImages({ imageMap: fileMap });
                                isHydrating.current = false;
                            }
                        });
                    }
                },
                onImagePasted: (data) => {
                    console.log("[EditorDom] Paste detected!", data.imageId);
                },
                onFilePasted: async (data) => {
                    if (!noteIdRef.current) return;
                    try {
                        const processed = await NoteFileService.processAndInsertFile(noteIdRef.current, data.localPath, 'application/pdf');
                        handleCommandRef.current?.('insertFileAttachment', {
                            fileId: processed.fileId,
                            fileName: processed.fileName,
                            fileSize: processed.fileSize,
                            localPath: processed.localPath,
                            mimeType: processed.mimeType
                        });
                    } catch (err) {
                        console.error('[EditorDom] Failed to process pasted PDF:', err);
                    }
                },

                defaultCodeLanguage: editorSettings.defaultCodeLanguage,
            }).then(exts => {
                if (isMounted) setExtensions(exts);
            });
            return () => { isMounted = false; };
        }, [
            placeholder,
        ]);

        useImperativeHandle(ref, () => ({
            getContent: () => Promise.resolve(editor && !editor.isDestroyed ? editor.getHTML() : ''),
            setContent: (content: string) => {
                if (editor && !editor.isDestroyed) {
                    editor.commands.setContent(content);
                }
            },
            focus: () => {
                if (editor && !editor.isDestroyed) {
                    editor.commands.focus();
                }
            },
            blur: () => {
                if (editor && !editor.isDestroyed) {
                    editor.commands.blur();
                }
            },
            onCommand: handleCommand,
            getSelection: () => {
                if (!editor || editor.isDestroyed) return { text: '', html: '', range: { from: 0, to: 0 } };
                const { selection } = editor.state;
                const { from, to } = selection;

                // Get HTML of selection
                let html = '';
                if (from !== to) {
                    const slice = selection.content();
                    const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content);
                    const div = document.createElement('div');
                    div.appendChild(fragment);
                    html = prepareMarksHTMLForClipboard(div.innerHTML);
                }

                return {
                    text: getPlainTextFromFragment(selection.content()),
                    html,
                    range: { from, to }
                };
            },
            search: (term: string) => {
                if (editor && !editor.isDestroyed) {
                    return (editor.commands as any).search(term);
                }
            },
            searchNext: () => {
                if (editor && !editor.isDestroyed) {
                    return (editor.commands as any).searchNext();
                }
            },
            searchPrev: () => {
                if (editor && !editor.isDestroyed) {
                    return (editor.commands as any).searchPrev();
                }
            },
            clearSearch: () => {
                if (editor && !editor.isDestroyed) {
                    return (editor.commands as any).clearSearch();
                }
            },
            scrollToElement: (id: string) => {
                // Desktop is native DOM. We don't need to fight TipTap's virtual state.
                // Just poll the DOM until the element renders, then scroll to it.
                let attempts = 0;

                const interval = setInterval(() => {
                    attempts++;

                    const el = document.getElementById(id) ||
                        document.querySelector(`[data-id="${id}"]`) ||
                        document.querySelector(`[blockId="${id}"]`);

                    if (el) {
                        clearInterval(interval); // Found it! Stop polling.

                        // If it's hidden inside a <details> block, force it open
                        const detailsAncestor = el.closest('details');
                        if (detailsAncestor && !detailsAncestor.open) {
                            detailsAncestor.open = true;
                        }

                        // Pure, native browser scroll. 
                        // We strictly DO NOT touch the TipTap selection here to prevent jump collisions.
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Optional: Give it a slight background flash so the user knows what they linked to,
                        // since we aren't using TipTap's highlight selection anymore.
                        const originalTransition = (el as HTMLElement).style.transition;
                        const originalBg = (el as HTMLElement).style.backgroundColor;

                        (el as HTMLElement).style.transition = 'background-color 0.3s';
                        (el as HTMLElement).style.backgroundColor = 'var(--accent-color, rgba(100, 150, 255, 0.2))';

                        setTimeout(() => {
                            (el as HTMLElement).style.backgroundColor = originalBg;
                            setTimeout(() => { (el as HTMLElement).style.transition = originalTransition; }, 300);
                        }, 1000);

                        return;
                    }

                    // Give up after ~2 seconds (40 attempts * 50ms)
                    if (attempts >= 40) {
                        clearInterval(interval);
                    }
                }, 50);
            },
            scrollToPosition: (position: number) => {
                if (scrollerRef.current) {
                    scrollerRef.current.scrollTop = position;
                }
            },
        }), [editor]);

        useEffect(() => {
            if (editor && !editor.isDestroyed && initialContent) {
                const imageIds = extractImageIds(initialContent);
                if (imageIds.length > 0) {
                    NoteFileService.resolveFileSources(imageIds).then((fileMap: any) => {
                        if (editor && !editor.isDestroyed && Object.keys(fileMap).length > 0) {
                            isHydrating.current = true;
                            (editor.commands as any).resolveImages({ imageMap: fileMap });
                            isHydrating.current = false;
                        }
                    });
                }
            }
        }, [editor, initialContent]);

        useGlobalPasteHandler({
            noteId,
            editorRef,
            handleCommand,
        });

        return (
            <div dir={direction} ref={containerRef} className="editor-dom-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                <style>{`
                    .editor-dom-container ::selection {
                        background-color: var(--selection-bg, rgba(0, 122, 255, 0.2)) !important;
                        color: inherit !important;
                    }
                    /* For Firefox */
                    .editor-dom-container ::-moz-selection {
                        background-color: var(--selection-bg, rgba(0, 122, 255, 0.2)) !important;
                        color: inherit !important;
                    }
                    ${DESKTOP_SELECTION_STYLES}
                    .ProseMirror[dir="rtl"] {
                        unicode-bidi: isolate; 
                    }
                    .ProseMirror[dir="rtl"] p {
                        unicode-bidi: isolate;
                    }
                    .editor-dom-container[dir="rtl"] .annota-drag-handle {
                        transform: translate(4px, 2px) !important;
                    }
                    .editor-dom-container[dir="ltr"] .annota-drag-handle {
                        transform: translate(-4px, 2px) !important;
                    }
                `}</style>
                {renderToolbar?.({
                    editorState,
                    sendCommand: handleCommand,
                    onCommand: handleCommand,
                    toolbarHeight: 50,
                    onDismissKeyboard: () => {
                        if (editor && !editor.isDestroyed) {
                            editor.commands.blur();
                        }
                    },
                    activePopup: activePopup as any,
                    onActivePopupChange: (type) => {
                        setActivePopup(type as any);
                        if (!type) {
                            setCurrentLatex(null);
                            setIsBlockMath(false);
                        }
                    },
                    onPopupStateChange: (isOpen) => {
                        if (!isOpen) {
                            setActivePopup(null);
                            setCurrentLatex(null);
                            setIsBlockMath(false);
                        }
                    },
                    onInsertFile: async (source: 'url' | 'library' | 'camera' | 'document', value?: string) => {
                        if (!noteId) return false;
                        try {
                            const insertImage = ({ imageId, src }: { imageId: string; src: string }) => {
                                handleCommand('insertLocalImage', { imageId, src });
                            };
                            const insertAttachment = (params: any) => {
                                handleCommand('insertFileAttachment', params);
                            };

                            if (source === 'url' && value) {
                                await insertRemoteFile(noteId, value, { insertImage });
                                return true;
                            } else if (source === 'library' && value) {
                                await insertProcessedFile(noteId, value, { insertImage, insertAttachment });
                                return true;
                            }
                            return false;
                        } catch (e) {
                            console.error('Failed to insert file:', e);
                            return false;
                        }
                    },
                    currentLatex,
                    isBlockMath,
                    blockData: null,
                    onInsertMath: () => {
                        setCurrentLatex(null);
                        setIsBlockMath(false);
                        setActivePopup('math');
                    }
                })}
                <div
                    className="premium-scrollbar"
                    ref={scrollerRef}
                    onScroll={onScroll}
                    dir={direction} style={{
                        flex: 1,
                        overflowY: 'auto',
                        scrollPaddingBottom: 100
                    }}>
                    <div style={{
                        maxWidth: editorSettings.noteWidth || '100%',
                        margin: '0 auto',
                        minHeight: '100%'
                    }}>
                        {renderStaticHeader && renderStaticHeader()}
                        {extensions && <EditorContent editor={editor} style={{ outline: 'none', paddingTop: contentPaddingTop, paddingBottom: initialContent && initialContent.length > 100 ? 100 : 0 }} />}
                    </div>
                </div>
                {renderHeader && renderHeader()}
                {gallery.isVisible && renderImageGallery?.({
                    images: gallery.images,
                    initialIndex: gallery.currentIndex,
                    visible: true,
                    onClose: closeGallery,
                    onNavigate: setGalleryIndex
                })}
            </div>
        );
    }
));

EditorDom.displayName = 'EditorDom';
export default EditorDom;
