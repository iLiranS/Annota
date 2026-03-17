import { useSettingsStore } from '@annota/core';
import { getPlatformAdapters, NoteImageService } from '@annota/core/platform';
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
        placeholder = 'Start typing...',
        autofocus = false,
        onSearchResults,
        contentPaddingTop = 0,
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
                openGallery(data.images, data.currentIndex);
            },
            onResolveImageIds: (data) => {
                if (data.imageIds.length > 0) {
                    NoteImageService.resolveImageSources(data.imageIds).then((imageMap) => {
                        if (Object.keys(imageMap).length > 0) {
                            isHydrating.current = true;
                            (editor?.commands as any).resolveImages({ imageMap });
                            isHydrating.current = false;
                        }
                    });
                }
            },
            onImagePasted: (data) => {
                console.log("[EditorDom] Paste detected!", data.imageId);

                if (!noteId || !editorRef.current) {
                    console.error("[EditorDom] Paste aborted: Missing noteId or editor", { noteId, hasEditor: !!editorRef.current });
                    return;
                }

                // 1. Internal paste (copying an image from within the note)
                if (data.imageId && !data.imageId.startsWith('temp-')) {
                    editorRef.current.chain().focus().insertContent({
                        type: 'image',
                        attrs: { src: data.src || '', imageId: data.imageId }
                    }).run();
                    return;
                }

                // 2. External paste
                (async () => {
                    try {
                        console.log("[EditorDom] Processing external paste...");
                        const adapters = getPlatformAdapters();
                        const cacheDir = await adapters.fileSystem.ensureDir('cache');

                        const mimeMatch = data.base64.match(/^data:(image\/\w+);base64,/);
                        const ext = (mimeMatch ? mimeMatch[1] : 'image/png').split('/').pop() || 'png';
                        const tempFilename = `pasted-${Date.now()}.${ext}`;
                        const sep = cacheDir.includes('\\') ? '\\' : '/';
                        const tempPath = `${cacheDir}${cacheDir.endsWith(sep) ? '' : sep}${tempFilename}`;

                        // NATIVE BASE64 DECODING (No Buffer required!)
                        const response = await fetch(data.base64);
                        const arrayBuffer = await response.arrayBuffer();
                        const rawBytes = new Uint8Array(arrayBuffer);

                        console.log("[EditorDom] Writing to cache:", tempPath);
                        await adapters.fileSystem.writeBytes(tempPath, rawBytes);

                        console.log("[EditorDom] Handing off to NoteImageService...");
                        const processed = await NoteImageService.processAndInsertImage(noteId, tempPath);
                        const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);

                        console.log("[EditorDom] Replacing placeholder with DB ID:", processed.imageId);
                        (editorRef.current.commands as any).replaceImageId({
                            oldId: data.imageId,
                            newId: processed.imageId,
                            src: imageMap[processed.imageId]
                        });

                        await adapters.fileSystem.deleteFile(tempPath).catch(() => { });
                        console.log("[EditorDom] Paste successfully processed!");
                    } catch (err) {
                        console.error('[EditorDom] Failed to handle pasted image:', err);
                    }
                })();
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
            onGalleryVisibilityChange
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
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        return (
            <div ref={containerRef} className="editor-dom-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', paddingTop: contentPaddingTop }}>
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
                        <EditorContent editor={editor} style={{ outline: 'none' }} />
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
