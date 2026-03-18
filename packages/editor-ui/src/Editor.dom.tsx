import { useSettingsStore } from '@annota/core';
import { NoteImageService } from '@annota/core/platform';
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
        onOpenImageMenu,
        onOpenTableMenu,
        onCodeBlockSelected,
        onSlashCommand,
        onTagCommand,
        onNoteLinkCommand,
        renderToolbar,
        renderHeader,
        renderImageGallery,
        isDark: propIsDark,
        colors: propColors,
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
            onSearchResults,
            onOpenBlockMenu,
            onOpenImageMenu,
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
                    NoteImageService.resolveImageSources(data.imageIds).then((imageMap) => {
                        if (Object.keys(imageMap).length > 0) {
                            isHydrating.current = true;
                            (editor.commands as any).resolveImages({ imageMap });
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
            onOpenImageMenu,
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
        }), [editorSettings.direction, onOpenTableMenu]);

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
                        //@ts-expect-error
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
            root.style.setProperty('--placeholder-color', dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
            root.style.setProperty('--code-bg', dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
            root.style.setProperty('--code-block-bg', dark ? '#1E1E1E' : '#F5F5F5');
            root.style.setProperty('--border-color', dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
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
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [editor]);

        // Inside Editor.dom.tsx
        const handleCommand = useCallback((cmd: string, params?: any) => {
            // Intercept UI commands and open popups
            if (['openMathModal', 'openImageModal', 'openLinkModal', 'openYoutubeModal'].includes(cmd)) {
                switch (cmd) {
                    case 'openMathModal': setCurrentLatex(null); setActivePopup('math'); return;
                    case 'openImageModal': setActivePopup('image'); return;
                    case 'openLinkModal': setActivePopup('link'); return;
                    case 'openYoutubeModal': setActivePopup('youtube'); return;
                }
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
                    NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                        if (Object.keys(imageMap).length > 0) {
                            isHydrating.current = true;
                            (editor.commands as any).resolveImages({ imageMap });
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

                const items = e.clipboardData?.items;
                if (!items) return;

                let imageFile: File | null = null;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        imageFile = items[i].getAsFile();
                        break;
                    }
                }

                // If it's an image, hijack the event!
                if (imageFile) {
                    // 1. Stop TipTap from ever seeing this paste
                    e.preventDefault();
                    e.stopPropagation();

                    // 2. Read the file to Base64
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const base64 = event.target?.result as string;
                        if (base64) {
                            try {
                                // 3. Upload it exactly like the Toolbar does
                                const { id, url } = await NoteImageService.saveNoteImage(noteId, base64);

                                // 4. Safely insert the final local URL into the editor
                                handleCommand('insertLocalImage', {
                                    imageId: id,
                                    src: url
                                });
                            } catch (err) {
                                console.error('[EditorDom] Global paste upload failed:', err);
                            }
                        }
                    };
                    reader.readAsDataURL(imageFile);
                }
            };

            // Use capture: true to intercept the event on the way DOWN the DOM tree, 
            // guaranteeing we catch it before TipTap does!
            document.addEventListener('paste', handleGlobalPaste, { capture: true });

            return () => {
                document.removeEventListener('paste', handleGlobalPaste, { capture: true });
            };
        }, [noteId, handleCommand]);

        return (
            <div ref={containerRef} className="editor-dom-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                {renderToolbar?.({
                    editorState,
                    sendCommand: handleCommand,
                    onCommand: handleCommand,
                    toolbarHeight: 50,
                    onDismissKeyboard: () => editor?.commands.blur(),
                    activePopup: activePopup as any,
                    onActivePopupChange: setActivePopup as any,
                    onPopupStateChange: (isOpen) => { if (!isOpen) setActivePopup(null); },
                    onInsertImage: async (source: 'url' | 'library' | 'camera', value?: string) => {
                        if (!noteId) return false;
                        try {
                            if (source === 'url' && value) {
                                const processed = await NoteImageService.processRemoteImage(noteId, value);
                                const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                                if (editor) {
                                    handleCommand('insertLocalImage', {
                                        imageId: processed.imageId,
                                        src: imageMap[processed.imageId]
                                    });
                                }
                                return true;
                            } else if (source === 'library' && value) {
                                const processed = await NoteImageService.processAndInsertImage(noteId, value);
                                const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                                if (editor) {
                                    handleCommand('insertLocalImage', {
                                        imageId: processed.imageId,
                                        src: imageMap[processed.imageId]
                                    });
                                }
                                return true;
                            }
                            return false;
                        } catch (e) {
                            console.error('Failed to insert image:', e);
                            return false;
                        }
                    },
                    currentLatex,
                    blockData: null,
                    onInsertMath: () => {
                        setActivePopup('math');
                    }
                })}
                <div className="editor-scroller" style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
                    <div style={{ maxWidth: editorSettings.noteWidth || '100%', margin: '0 auto', minHeight: '100%' }}>
                        {renderHeader?.()}
                        <EditorContent editor={editor} style={{ outline: 'none', paddingTop: contentPaddingTop }} />
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
