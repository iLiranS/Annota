import { useSettingsStore } from '@annota/core';
import { NoteFileService } from '@annota/core/platform';
import { dispatchEditorCommand, getBaseExtensions, getEditorProps, getEditorState, getExtensions } from '@annota/editor-core';
import '@annota/editor-core/highlight-theme.css';
import '@annota/editor-core/styles.css';
import { DOMSerializer } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useEditorThemeVariables } from './hooks/useEditorThemeVariables';
import { useSharedEditorUI } from './hooks/useSharedEditorUI';
import { AutoShowHeader } from './shared/AutoShowHeader';
import { DESKTOP_SELECTION_STYLES } from './shared/desktopSelectionStyles';
import { EditorState, initialEditorState, PopupType, TipTapEditorProps, TipTapEditorRef } from './shared/types';

function extractImageIds(html: string): string[] {
    const regex = /data-image-id\s*=\s*(["'])(.*?)\1/gi;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        const id = match[2];
        // SAFETY CHECK: Never extract temporary upload placeholders
        if (!id.startsWith('temp-')) {
            ids.push(id);
        }
    }
    return ids;
}

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
        isStandalone,
        direction: propDirection,
        onScroll,
    }, ref) => {
        const colors = useMemo(() => propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' }, [propColors]);
        const dark = propIsDark ?? false;
        const editorSettings = useSettingsStore(s => s.editor);
        const direction = propDirection || editorSettings.direction;
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const { gallery, openGallery, closeGallery, setGalleryIndex } = useSharedEditorUI(onGalleryVisibilityChange);
        const containerRef = useRef<HTMLDivElement>(null);
        const scrollerRef = useRef<HTMLDivElement>(null);
        const isHydrating = useRef(false);
        const editorRef = useRef<any>(null);
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

        const [extensions, setExtensions] = useState<any[]>(() => getBaseExtensions({ placeholder }));


        const editorProps = useMemo(() => {
            const baseProps = getEditorProps({
                direction: direction,
                spellcheck: editorSettings.spellcheck,
                autocorrect: editorSettings.autocorrect,
                autocapitalize: editorSettings.autocapitalize,
                autocomplete: editorSettings.autocomplete,
                onContextMenu: (view, event) => {
                    const linkElement = event.composedPath().find((el: any) => el.nodeName === 'A') as HTMLAnchorElement | undefined;

                    if (linkElement && linkElement.href && onOpenLinkMenuRef.current) {
                        const { state, dispatch } = view;

                        const coords = { left: event.clientX, top: event.clientY };
                        const posResult = view.posAtCoords(coords);
                        const pos = posResult ? posResult.pos : view.posAtDOM(event.target as Node, 0);

                        if (pos !== null) {
                            const { doc, schema } = state;
                            const markType = schema.marks.link;
                            if (markType) {
                                const $pos = doc.resolve(pos);
                                const range = $pos.markAround(markType);
                                if (range) {
                                    dispatch(state.tr.setSelection(TextSelection.create(doc, range.from, range.to)));
                                } else {
                                    dispatch(state.tr.setSelection(TextSelection.create(doc, pos)));
                                }
                            }
                        }

                        event.preventDefault();
                        const capturedHref = linkElement.href;
                        setTimeout(() => {
                            onOpenLinkMenuRef.current?.(event as any, capturedHref);
                        }, 50);
                        return true;
                    }

                    if (!onOpenTableMenuRef.current) return false;

                    const { state, dispatch } = view;
                    const pos = view.posAtDOM(event.target as Node, 0);
                    if (pos === null) return false;

                    const $pos = state.doc.resolve(pos);
                    let isInTable = false;
                    let tableNodePos = -1;
                    let cellNodePos = -1;

                    for (let d = $pos.depth; d > 0; d--) {
                        const node = $pos.node(d);
                        if (node.type.name === 'table') {
                            isInTable = true;
                            tableNodePos = $pos.before(d);
                        }
                        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                            cellNodePos = $pos.before(d);
                        }
                    }

                    if (isInTable) {
                        event.preventDefault();

                        const { selection } = state;
                        let shouldSetSelection = true;

                        // Bulletproof check for CellSelection
                        const isCellSelection = (selection as any).constructor.name === 'CellSelection' || selection.toJSON().type === 'cell';

                        if (isCellSelection) {
                            // Check if the clicked DOM position falls inside the current multi-cell ranges
                            const ranges = (selection as any).ranges;
                            for (let i = 0; i < ranges.length; i++) {
                                if (pos >= ranges[i].$from.pos && pos <= ranges[i].$to.pos) {
                                    shouldSetSelection = false; // User clicked inside their selection, preserve it!
                                    break;
                                }
                            }
                        } else {
                            // Single cursor check
                            const isSelectionInClickedCell = selection.$from.depth >= $pos.depth &&
                                selection.$from.before($pos.depth) === cellNodePos;
                            if (isSelectionInClickedCell) shouldSetSelection = false;
                        }

                        if (shouldSetSelection) {
                            dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
                        }

                        const cellNode = state.doc.nodeAt(cellNodePos);

                        // Calculate merge capability with a manual fallback for ProseMirror quirks
                        let canMerge = editorRef.current?.can().mergeCells() || false;
                        if (!canMerge && isCellSelection) {
                            const cellSel = selection as any;
                            // If anchor and head are in different positions, multiple cells are selected
                            if (cellSel.$anchorCell && cellSel.$headCell && cellSel.$anchorCell.pos !== cellSel.$headCell.pos) {
                                canMerge = true;
                            }
                        }
                        // Calculate split capability with a manual fallback
                        let canSplit = editorRef.current?.can().splitCell() || false;
                        if (!canSplit && cellNode) {
                            // If the cell spans multiple columns or rows, it can be split!
                            if ((cellNode.attrs.colspan && cellNode.attrs.colspan > 1) ||
                                (cellNode.attrs.rowspan && cellNode.attrs.rowspan > 1)) {
                                canSplit = true;
                            }
                        }
                        onOpenTableMenuRef.current?.(event, () => ({
                            pos: tableNodePos,
                            message: {
                                type: 'openBlockMenu',
                                blockType: 'table',
                                pos: tableNodePos,
                                cellPos: cellNodePos,
                                backgroundColor: cellNode?.attrs.backgroundColor,
                                canMergeCells: canMerge,
                                canSplitCell: canSplit, // Use our calculated fallback
                            }
                        }));
                        return true;
                    }

                    return false;
                }
            });

            return {
                ...baseProps,
                handleScrollToSelection: () => {
                    // If we are in RTL, completely kill ProseMirror's auto-scroll.
                    // This stops the desktop micro-jumps entirely.
                    if (direction === 'rtl') {
                        return true;
                    }
                    return false;
                }
            };
        }, [direction, editorSettings]); // callbacks are accessed via refs, no need to re-create


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
                const html = editor.getHTML();
                onContentChange?.(html);
                setEditorState(getEditorState(editor) as unknown as EditorState);
            },
            onSelectionUpdate: ({ editor }) => {
                const { selection } = editor.state;
                let latex = '';

                // Extract latex if we clicked on a math node, or extract highlighted text
                if ((selection as any).node?.type.name === 'inlineMath') {
                    latex = (selection as any).node.attrs.latex;
                } else if (!selection.empty) {
                    latex = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                }

                setCurrentLatex(latex || null);
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
                        text: editor.state.doc.textBetween(selection.from, selection.to, ' '),
                        nodeName: (selection as any).node?.type.name
                    });
                }
            },
            onTransaction: ({ editor }) => {
                setEditorState(getEditorState(editor) as unknown as EditorState);
            },
        }, [noteId, extensions]);

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
            }
        }, [editor, editorProps, editorSettings]);


        useEditorThemeVariables({ colors, dark, editorSettings, rootRef: containerRef });

        // Capture-phase contextmenu handler for links.
        // Attaches on `document` in capture phase to guarantee it fires before
        // Tauri/WebView shows its native context menu for <a> elements.
        useEffect(() => {
            const handler = (event: MouseEvent) => {
                // Only handle right-clicks inside our editor container
                const container = containerRef.current;
                if (!container || !container.contains(event.target as Node)) return;

                // Find an <a> element in the event path (safe for text nodes)
                const link = event.composedPath().find((el: any) => el?.tagName === 'A') as HTMLAnchorElement | undefined;
                if (!link || !link.href) return;

                // Only intercept if our callback is ready
                if (!onOpenLinkMenuRef.current) return;

                event.preventDefault();
                event.stopPropagation();

                // Try to select the full link range in the editor
                try {
                    const editor = editorRef.current;
                    if (editor?.isDestroyed === false && editor?.view) {
                        const view = editor.view;
                        const { state, dispatch } = view;
                        const coords = { left: event.clientX, top: event.clientY };
                        const posResult = view.posAtCoords(coords);
                        if (posResult) {
                            const { doc, schema } = state;
                            const markType = schema.marks.link;
                            if (markType) {
                                const $pos = doc.resolve(posResult.pos);
                                const range = $pos.markAround(markType);
                                if (range) {
                                    dispatch(state.tr.setSelection(TextSelection.create(doc, range.from, range.to)));
                                }
                            }
                        }
                    }
                } catch {
                    // Editor not ready — skip selection update, still open the menu
                }

                const capturedHref = link.href;
                setTimeout(() => {
                    onOpenLinkMenuRef.current?.(event as any, capturedHref);
                }, 50);
            };

            document.addEventListener('contextmenu', handler, true);
            return () => document.removeEventListener('contextmenu', handler, true);
        }, []); // empty deps — callbacks via refs, editorRef is stable


        // Keyboard Shortcuts
        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                const isMod = e.metaKey || e.ctrlKey;
                const isShift = e.shiftKey;
                const key = e.key.toLowerCase();

                if (key === 'tab') {
                    if (editor && editor.isFocused) {
                        // Always prevent browser focus jumping when in the editor.
                        // TipTap's internal keyboard shortcuts (Indentation and Table) 
                        // will handle the actual logic.
                        e.preventDefault();
                        return;
                    }
                }

                if (isMod && isShift && key === 'm') {
                    if (!editor) return;
                    e.preventDefault();

                    const { selection } = editor.state;
                    let latex = '';

                    if ((selection as any).node?.type.name === 'inlineMath') {
                        latex = (selection as any).node.attrs.latex;
                    } else {
                        latex = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                    }

                    setCurrentLatex(latex || null);
                    requestAnimationFrame(() => {
                        setActivePopup('math');
                    });
                } else if (isMod && key === 'k') {
                    if (!editor) return;
                    e.preventDefault();
                    requestAnimationFrame(() => {
                        setActivePopup('link');
                    });
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [editor]);

        // Inside Editor.dom.tsx
        const handleCommand = useCallback(async (cmd: string, params?: any) => {
            // Intercept UI commands and open popups
            if (['openMathModal', 'openFileModal', 'openLinkModal', 'openYoutubeModal'].includes(cmd)) {
                switch (cmd) {
                    case 'openMathModal': setCurrentLatex(null); setActivePopup('math'); return;
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

            // Otherwise, dispatch to TipTap
            if (editor) await dispatchEditorCommand(editor as any, cmd, params || {});
        }, [editor]);
        handleCommandRef.current = handleCommand;

        useEffect(() => {
            let isMounted = true;
            getExtensions({
                placeholder,
                onMathSelected: (latex) => {
                    setCurrentLatex(latex);
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
                    if (editorRef.current) {
                        editorRef.current.commands.blur();
                    }
                    openGalleryRef.current?.(data.images, data.currentIndex);
                },
                onResolveImageIds: (data) => {
                    if (data.imageIds.length > 0) {
                        NoteFileService.resolveFileSources(data.imageIds).then((fileMap) => {
                            if (Object.keys(fileMap).length > 0) {
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

                defaultCodeLanguage: editorSettings.defaultCodeLanguage,
            }).then(exts => {
                if (isMounted) setExtensions(exts);
            });
            return () => { isMounted = false; };
        }, [
            placeholder,
            editorSettings.defaultCodeLanguage,
        ]);

        useImperativeHandle(ref, () => ({
            getContent: () => Promise.resolve(editor?.getHTML() || ''),
            setContent: (content: string) => editor?.commands.setContent(content),
            focus: () => editor?.commands.focus(),
            blur: () => editor?.commands.blur(),
            onCommand: handleCommand,
            getSelection: () => {
                if (!editor) return { text: '', html: '', range: { from: 0, to: 0 } };
                const { selection } = editor.state;
                const { from, to } = selection;

                // Get HTML of selection
                let html = '';
                if (from !== to) {
                    const slice = editor.state.doc.slice(from, to);
                    const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content);
                    const div = document.createElement('div');
                    div.appendChild(fragment);
                    html = div.innerHTML;
                }

                return {
                    text: editor.state.doc.textBetween(from, to, ' '),
                    html,
                    range: { from, to }
                };
            },
            search: (term: string) => (editor?.commands as any).search(term),
            searchNext: () => (editor?.commands as any).searchNext(),
            searchPrev: () => (editor?.commands as any).searchPrev(),
            clearSearch: () => (editor?.commands as any).clearSearch(),
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
        }), [editor]);

        useEffect(() => {
            if (editor && initialContent) {
                const imageIds = extractImageIds(initialContent);
                if (imageIds.length > 0) {
                    NoteFileService.resolveFileSources(imageIds).then((fileMap: any) => {
                        if (Object.keys(fileMap).length > 0) {
                            isHydrating.current = true;
                            (editor.commands as any).resolveImages({ imageMap: fileMap });
                            isHydrating.current = false;
                        }
                    });
                }
            }
        }, [editor, initialContent]);

        // THE GLOBAL PASTE INTERCEPTOR
        useEffect(() => {
            const handleGlobalPaste = async (e: ClipboardEvent) => {
                if (!noteId || !editorRef.current) return;

                // 0. SKIP IF FOCUS IS IN AN INPUT OR TEXTAREA (like Mermaid editor)
                const target = e.target as HTMLElement;
                if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

                // 1. CHECK FOR INTERNAL HTML FIRST
                const htmlContent = e.clipboardData?.getData('text/html');

                // Check if the HTML contains your custom local URI scheme (e.g., asset:// or a custom data attribute)
                if (htmlContent && (htmlContent.includes('asset://') || htmlContent.includes('data-image-id'))) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    const imgElement = doc.querySelector('img');

                    if (imgElement && imgElement.src) {
                        console.log("Internal DOM copy detected! Bypassing binary upload.");
                        e.preventDefault();
                        e.stopPropagation();

                        // Extract the ID from either your custom data attribute or parse it from the src URL
                        const imageId = imgElement.getAttribute('data-image-id') ||
                            imgElement.src.split(/[\/\\]/).pop()?.split('.')[0] ||
                            'unknown-id';

                        handleCommand('insertLocalImage', {
                            imageId: imageId,
                            src: imgElement.src
                        });
                        return; // STOP execution. Do not upload the mangled binary!
                    }
                }

                // 2. FALLBACK TO BINARY UPLOAD (For external files from the web or OS)
                const items = e.clipboardData?.items;
                if (!items) return;

                // CHECK FOR PDF ATTACHMENT IN CLIPBOARD
                const pdfFile = Array.from(items).find(item => item.type === 'application/pdf');
                if (pdfFile) {
                    const file = pdfFile.getAsFile();
                    if (file) {
                        e.preventDefault();
                        const processed = await NoteFileService.processAndInsertFile(noteId, URL.createObjectURL(file), 'application/pdf');
                        handleCommand('insertFileAttachment', {
                            fileId: processed.fileId,
                            fileName: processed.fileName,
                            fileSize: processed.fileSize,
                            localPath: processed.localPath,
                            mimeType: processed.mimeType
                        });
                        return;
                    }
                }

                let fileToUpload: File | null = null;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.startsWith('image/') || item.type === 'application/pdf') {
                        fileToUpload = item.getAsFile();
                        if (fileToUpload) break;
                    }
                }

                if (fileToUpload) {
                    console.log("External binary paste detected. Uploading...", fileToUpload.type);
                    e.preventDefault();
                    e.stopPropagation();

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const base64 = event.target?.result as string;
                        if (base64) {
                            try {
                                const processed = await NoteFileService.saveNoteFile(noteId, base64);
                                if (processed.mimeType === 'application/pdf') {
                                    handleCommand('insertFileAttachment', {
                                        fileId: processed.id,
                                        fileName: processed.fileName,
                                        fileSize: processed.fileSize,
                                        localPath: processed.localPath,
                                        mimeType: processed.mimeType
                                    });
                                } else {
                                    handleCommand('insertLocalImage', { imageId: processed.id, src: processed.url });
                                }
                            } catch (err) {
                                console.error('[EditorDom] Global paste upload failed:', err);
                            }
                        }
                    };
                    reader.readAsDataURL(fileToUpload);
                }
            };

            document.addEventListener('paste', handleGlobalPaste, { capture: true });

            return () => {
                document.removeEventListener('paste', handleGlobalPaste, { capture: true });
            };
        }, [noteId, handleCommand]);

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
                `}</style>
                {renderToolbar?.({
                    editorState,
                    sendCommand: handleCommand,
                    onCommand: handleCommand,
                    toolbarHeight: 50,
                    onDismissKeyboard: () => editor?.commands.blur(),
                    activePopup: activePopup as any,
                    onActivePopupChange: setActivePopup as any,
                    onPopupStateChange: (isOpen) => { if (!isOpen) setActivePopup(null); },
                    onInsertFile: async (source: 'url' | 'library' | 'camera' | 'document', value?: string) => {
                        if (!noteId) return false;
                        try {
                            if (source === 'url' && value) {
                                const processed = await NoteFileService.processRemoteFile(noteId, value);
                                const fileMap = await NoteFileService.resolveFileSources([processed.fileId]);
                                if (editor) {
                                    handleCommand('insertLocalImage', {
                                        imageId: processed.fileId,
                                        src: fileMap[processed.fileId]
                                    });
                                }
                                return true;
                            } else if (source === 'library' && value) {
                                const processed = await NoteFileService.processAndInsertFile(noteId, value);
                                const fileMap = await NoteFileService.resolveFileSources([processed.fileId]);

                                if (processed.mimeType === 'application/pdf') {
                                    handleCommand('insertFileAttachment', {
                                        fileId: processed.fileId,
                                        fileName: processed.fileName,
                                        fileSize: processed.fileSize,
                                        localPath: processed.localPath,
                                        mimeType: processed.mimeType
                                    });
                                } else {
                                    handleCommand('insertLocalImage', {
                                        imageId: processed.fileId,
                                        src: fileMap[processed.fileId]
                                    });
                                }
                                return true;
                            }
                            return false;
                        } catch (e) {
                            console.error('Failed to insert file:', e);
                            return false;
                        }
                    },
                    currentLatex,
                    blockData: null,
                    onInsertMath: () => {
                        setActivePopup('math');
                    }
                })}
                <div
                    className="editor-scroller"
                    ref={scrollerRef}
                    onScroll={onScroll}
                    dir={direction} style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: isStandalone ? '0 12px' : '0 24px',
                        scrollPaddingBottom: 100
                    }}>
                    <div style={{
                        maxWidth: editorSettings.noteWidth || '100%',
                        margin: '0 auto',
                        minHeight: '100%'
                    }}>
                        {renderHeader && (
                            <AutoShowHeader scrollContainerRef={scrollerRef}>
                                {renderHeader()}
                            </AutoShowHeader>
                        )}
                        {renderStaticHeader && renderStaticHeader()}
                        {extensions && <EditorContent editor={editor} style={{ outline: 'none', paddingTop: contentPaddingTop, paddingBottom: initialContent && initialContent.length > 100 ? 100 : 0 }} />}
                    </div>
                </div>
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
