import { useSettingsStore } from '@annota/core';
import { NoteFileService } from '@annota/core/platform';
import { dispatchEditorCommand, getEditorProps, getEditorState, getExtensions, resolveFontFamily } from '@annota/editor-core';
import '@annota/editor-core/styles.css';
import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useSharedEditorUI } from './hooks/useSharedEditorUI';
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
        renderToolbar,
        renderHeader,
        renderImageGallery,
        isDark: propIsDark,
        colors: propColors,
        isStandalone,
    }, ref) => {
        const colors = propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' };
        const dark = propIsDark ?? false;
        const { editor: editorSettings } = useSettingsStore();
        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);
        const { gallery, openGallery, closeGallery, setGalleryIndex } = useSharedEditorUI(onGalleryVisibilityChange);
        const containerRef = useRef<HTMLDivElement>(null);
        const isHydrating = useRef(false);
        const editorRef = useRef<any>(null);

        const extensions = useMemo(() => getExtensions({
            placeholder,
            onMathSelected: (latex) => {
                setCurrentLatex(latex);
                setActivePopup('math');
            },
            onOpenFile: (data) => handleCommand('openFile', data),
            onSearchResults,
            onOpenBlockMenu,
            onOpenFileMenu,
            onOpenTableMenu,
            onCodeBlockSelected,
            onSlashCommand,
            onTagCommand,
            onNoteLinkCommand,
            onImageSelected: (data) => {
                // Drop focus so the cursor doesn't blink behind the dark overlay
                if (editorRef.current) {
                    editorRef.current.commands.blur();
                }
                openGallery(data.images, data.currentIndex);
            },
            onResolveImageIds: (data) => {
                if (data.imageIds.length > 0) {
                    NoteFileService.resolveFileSources(data.imageIds).then((fileMap) => {
                        if (Object.keys(fileMap).length > 0) {
                            isHydrating.current = true;
                            (editor.commands as any).resolveImages({ imageMap: fileMap });
                            isHydrating.current = false;
                        }
                    });
                }
            },
            onImagePasted: (data) => {
                console.log("[EditorDom] Paste detected!", data.imageId);
            },

            defaultCodeLanguage: editorSettings.defaultCodeLanguage,
        }), [
            placeholder,
            noteId,
            editorSettings.defaultCodeLanguage,
            onSearchResults,
            onOpenBlockMenu,
            onOpenFileMenu,
            onOpenTableMenu,
            onCodeBlockSelected,
            onSlashCommand,
            onTagCommand,
            onNoteLinkCommand,
            onGalleryVisibilityChange,
        ]);

        const editorProps = useMemo(() => getEditorProps({
            direction: editorSettings.direction,
            onContextMenu: (view, event) => {
                const target = event.target as HTMLElement;
                const linkElement = target.closest('a');
                if (linkElement && linkElement.href && linkElement.href.includes('annota://')) {
                    if (onOpenLinkMenu) {
                        event.preventDefault();
                        onOpenLinkMenu(event as any, linkElement.href);
                        return true;
                    }
                }

                if (!onOpenTableMenu) return false;



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
                    onOpenTableMenu(event, () => ({
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
        }), [editorSettings.direction, onOpenTableMenu, onOpenLinkMenu]);

        const editor = useEditor({
            editable,
            content: initialContent,
            extensions: extensions as any,
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
            },
            onTransaction: ({ editor }) => {
                setEditorState(getEditorState(editor) as unknown as EditorState);
            },
        }, [noteId]);

        // Theme sync logic
        useEffect(() => {
            const root = containerRef.current;
            if (!root) return;
            const finalBg = dark ? 'transparent' : colors.background;
            const finalTextColor = dark ? 'rgba(255, 255, 255, 0.85)' : colors.text;
            root.style.setProperty('--bg-color', finalBg);
            root.style.setProperty('--text-color', finalTextColor);
            root.style.setProperty('--accent-color', colors.primary);
            root.style.setProperty('--editor-font-size', `${editorSettings.fontSize}px`);
            root.style.setProperty('--editor-font-family', resolveFontFamily(editorSettings.fontFamily));
            root.style.setProperty('--editor-line-height', `${editorSettings.lineSpacing}`);
            root.style.setProperty('--editor-paragraph-spacing', `${editorSettings.paragraphSpacing}px`);
            root.style.setProperty('--editor-max-width', editorSettings.noteWidth > 0 ? `${editorSettings.noteWidth}px` : '100%');
            root.style.setProperty('--placeholder-color', dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
            root.style.setProperty('--code-bg', dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
            root.style.setProperty('--code-block-bg', dark ? '#1E1E1E' : '#F5F5F5');
            root.style.setProperty('--border-color', dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
            
            // Refined selection background (approx 25% opacity)
            let selectionColor = colors.primary;
            if (selectionColor.startsWith('#')) {
                selectionColor = selectionColor + "40"; // 25% opacity in hex
            } else {
                selectionColor = `rgba(var(--accent-color), 0.25)`;
            }
            root.style.setProperty('--selection-bg', selectionColor);
        }, [colors, dark, editorSettings]);
        // Keyboard Shortcuts
        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                const isMod = e.metaKey || e.ctrlKey;
                const isShift = e.shiftKey;
                const key = e.key.toLowerCase();

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
        const handleCommand = useCallback((cmd: string, params?: any) => {
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
            if (editor) dispatchEditorCommand(editor as any, cmd, params || {});
        }, [editor]);

        useImperativeHandle(ref, () => ({
            getContent: () => Promise.resolve(editor?.getHTML() || ''),
            setContent: (content: string) => editor?.commands.setContent(content),
            focus: () => editor?.commands.focus(),
            blur: () => editor?.commands.blur(),
            onCommand: handleCommand,
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
            <div ref={containerRef} className="editor-dom-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
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
                <div className="editor-scroller" style={{ 
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
                        {renderHeader?.()}
                        <EditorContent editor={editor} style={{ outline: 'none', paddingTop: contentPaddingTop, paddingBottom: initialContent && initialContent.length > 200 ? 100 : 0 }} />
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
