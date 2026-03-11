import { useSettingsStore } from '@annota/core';
import { getPlatformAdapters, NoteImageService } from '@annota/core/platform';
import { dispatchEditorCommand } from '@annota/editor-web/command-dispatcher';
import { getEditorProps, getEditorState, getExtensions, resolveFontFamily } from '@annota/editor-web/config';
import '@annota/editor-web/styles.css';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { EditorContent, useEditor } from '@tiptap/react';
import { Buffer } from 'buffer';
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
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

const getByteSize = (str: string) => {
    try {
        return new Blob([str]).size;
    } catch (e) {
        return new TextEncoder().encode(str).length;
    }
};

/**
 * Strip heavy inline src payloads (base64 data URIs) from images that carry
 * a data-image-id attribute before checking byte size.
 */
const getStorableByteSize = (html: string): number => {
    if (!html) return 0;
    const stripped = html.replace(/<img\b[^>]*>/gi, (imgTag) => {
        if (!/data-image-id\s*=\s*["'][^"']+["']/i.test(imgTag)) return imgTag;
        return imgTag
            .replace(/\s+src\s*=\s*(["']).*?\1/gi, ' src=""')
            .replace(/\s+src\s*=\s*[^\s>]+/gi, ' src=""');
    });
    return getByteSize(stripped);
};

export const NativeEditor = React.memo(forwardRef<TipTapEditorRef, TipTapEditorProps>(
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
        renderHeader,
        renderImageGallery,
        isDark: propIsDark,
        colors: propColors,
        onOpenBlockMenu,
        onOpenImageMenu,
        onOpenTableMenu,
        onCodeBlockSelected,
        onSlashCommand,
        onTagCommand,
    }, ref) => {
        const colors = propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' };
        const dark = propIsDark ?? false;
        const { editor: editorSettings } = useSettingsStore();

        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [isGalleryVisible, setIsGalleryVisible] = useState(false);
        const [galleryImages, setGalleryImages] = useState<ImageInfo[]>([]);
        const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
        const [activePopup, setActivePopup] = useState<PopupType>(null);
        const [currentLatex, setCurrentLatex] = useState<string | null>(null);

        const containerRef = React.useRef<HTMLDivElement>(null);
        const isHydrating = React.useRef(false);
        const editorRef = React.useRef<any>(null);
        const lastValidContentRef = React.useRef(initialContent);

        const extensions = React.useMemo(() => getExtensions({
            placeholder,
            //@ts-ignore
            onMathSelected: (latex, isBlock, pos) => {
                setCurrentLatex(latex);
                setActivePopup('math');
            },
            onImageSelected: (data) => {
                setGalleryImages(data.images);
                setGalleryCurrentIndex(data.currentIndex);
                setIsGalleryVisible(true);
                onGalleryVisibilityChange?.(true);
            },
            onSearchResults: (count, currentIndex) => {
                onSearchResults?.(count, currentIndex);
            },
            onOpenBlockMenu,
            onOpenImageMenu,
            onOpenTableMenu,
            onCodeBlockSelected,
            onResolveImageIds: (data) => {
                if (data.imageIds.length > 0) {
                    NoteImageService.resolveImageSources(data.imageIds).then((imageMap) => {
                        if (Object.keys(imageMap).length > 0) {
                            isHydrating.current = true;
                            (editorRef.current?.commands as any).resolveImages({ imageMap });
                            isHydrating.current = false;
                        }
                    });
                }
            },
            onImagePasted: (data) => {
                if (!noteId || !editorRef.current) return;

                // 1. THE MAGIC CHECK: Is this an internal image we already know about?
                // We check if imageId exists and doesn't start with 'temp-'
                if (data.imageId && !data.imageId.startsWith('temp-')) {
                    console.log("[NativeEditor] Internal image pasted, skipping re-upload:", data.imageId);
                    // Just insert it directly into TipTap using the existing ID and Src
                    (editorRef.current.chain() as any).focus().insertContent({
                        type: 'image',
                        attrs: {
                            src: data.src || '',
                            imageId: data.imageId
                        }
                    }).run();
                    return; // Stop here! Don't call NoteImageService at all.
                }

                // 2. Otherwise, it's a truly new external paste (or a temp one from internal path)
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

                        // Atomic update to prevent placeholder flash
                        // We do NOT set isHydrating here because we WANT this change to persist (new imageId)
                        (editorRef.current.commands as any).replaceImageId({
                            oldId: data.imageId,
                            newId: processed.imageId,
                            src: imageMap[processed.imageId]
                        });

                        await adapters.fileSystem.deleteFile(tempPath).catch(() => { });
                    } catch (err) {
                        console.error('Failed to handle pasted image in NativeEditor:', err);
                    }
                })();
            },
            defaultCodeLanguage: editorSettings.defaultCodeLanguage,
            onSlashCommand: onSlashCommand ? (data: any) => onSlashCommand(data) : undefined,
            onTagCommand: onTagCommand ? (data: any) => onTagCommand(data) : undefined,
        }) as any, [placeholder, onSearchResults, onOpenBlockMenu, onOpenImageMenu, onOpenTableMenu, onCodeBlockSelected, noteId, editorSettings.defaultCodeLanguage, onSlashCommand, onTagCommand]);

        const editorProps = React.useMemo(() => getEditorProps({
            direction: editorSettings.direction,
            onScroll: () => {
                // In native desktop, we might not need to report cursor pos via bridge
                // but we can if the toolbar needs it.
            },
            onContextMenu: (view, event) => {
                if (!onOpenTableMenu) return false;

                const { state, dispatch } = view;

                // Find the position where user right-clicked
                const pos = view.posAtDOM(event.target as Node, 0);
                if (pos === null) return false;

                const $pos = state.doc.resolve(pos);

                // Check if cursor is inside a table
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

                    // If the click happened in a different cell than current selection,
                    // move selection to the clicked cell, unless we're in a multi-cell selection
                    const { selection } = state;
                    let shouldSetSelection = true;

                    // Robust check for CellSelection
                    const isCellSelection = (selection instanceof CellSelection) || (selection as any).constructor.name === 'CellSelection';

                    if (isCellSelection) {
                        const cellSelection = selection as CellSelection;
                        let cellInSelection = false;
                        cellSelection.forEachCell((_node: any, cellPos: number) => {
                            if (cellPos === cellNodePos) cellInSelection = true;
                        });
                        if (cellInSelection) shouldSetSelection = false;
                    } else {
                        const isSelectionInClickedCell = selection.$from.depth >= $pos.depth &&
                            selection.$from.before($pos.depth) === cellNodePos;
                        if (isSelectionInClickedCell) shouldSetSelection = false;
                    }

                    if (shouldSetSelection) {
                        dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
                    }

                    // const tableNode = state.doc.nodeAt(tableNodePos);
                    const cellNode = state.doc.nodeAt(cellNodePos);

                    onOpenTableMenu(event, () => ({
                        pos: tableNodePos,
                        message: {
                            type: 'openBlockMenu',
                            blockType: 'table',
                            pos: tableNodePos,
                            cellPos: cellNodePos,
                            backgroundColor: cellNode?.attrs.backgroundColor,
                            canMergeCells: editorRef.current?.can().mergeCells() || false,
                            canSplitCell: editorRef.current?.can().splitCell() || false,
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
            immediatelyRender: false,
            extensions,
            editorProps,
            onCreate: ({ editor }) => {
                editorRef.current = editor;
                if (autofocus) {
                    editor.commands.focus();
                }
                setEditorState(getEditorState(editor) as EditorState);
            },
            onUpdate: ({ editor }) => {
                if (isHydrating.current) return;

                const html = editor.getHTML();
                const currentSize = getStorableByteSize(html);
                const previousSize = getStorableByteSize(lastValidContentRef.current);

                if (currentSize >= 145000 && currentSize > previousSize) {
                    // For now use a standard alert as web-view based editor might not have directToast access
                    console.log('Note Limit Reached: Note size is too large. Please shorten it or avoid pasting large uncompressed images.');

                    isHydrating.current = true;
                    editor.commands.setContent(lastValidContentRef.current, { emitUpdate: false });
                    isHydrating.current = false;
                    return;
                }

                lastValidContentRef.current = html;
                onContentChange?.(html);
                setEditorState(getEditorState(editor) as EditorState);
            },
            onSelectionUpdate: ({ editor }) => {
                const { selection } = editor.state;
                let latex = '';

                // Identify if current selection is relevant for Math Dialog
                if ((selection as any).node?.type.name === 'inlineMath') {
                    latex = (selection as any).node.attrs.latex;
                } else if (!selection.empty) {
                    latex = editor.state.doc.textBetween(selection.from, selection.to, ' ');
                }

                setCurrentLatex(latex || null);
                setEditorState(getEditorState(editor) as EditorState);
            },
            onTransaction: ({ editor }) => {
                setEditorState(getEditorState(editor) as EditorState);
            },
            onFocus: () => { },
            onBlur: () => { },
        }, [noteId]); // Re-init if noteId changes for safety, though setContent is preferred

        // Theme Sync
        useEffect(() => {
            const root = containerRef.current;
            if (!root) return;

            // Desktop polish: use a transparent background in dark mode to inherit from the parent container (which has bg-card/50)
            const finalBg = dark ? 'transparent' : colors.background;
            const finalTextColor = dark ? 'rgba(255, 255, 255, 0.85)' : colors.text;

            root.style.setProperty('--bg-color', finalBg);
            root.style.setProperty('--text-color', finalTextColor);
            root.style.setProperty('--accent-color', colors.primary);
            root.style.setProperty('--placeholder-color', dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
            root.style.setProperty('--code-bg', dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
            root.style.setProperty('--code-block-bg', dark ? '#1E1E1E' : '#F5F5F5');
            root.style.setProperty('--border-color', dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
            root.style.setProperty('--editor-font-size', `${editorSettings.fontSize}px`);
            root.style.setProperty('--editor-line-height', `${editorSettings.lineSpacing}`);
            root.style.setProperty('--editor-max-width', editorSettings.noteWidth > 0 ? `${editorSettings.noteWidth}px` : '100%');
            root.style.setProperty('--editor-padding-top', `${contentPaddingTop}px`);

            const resolvedFont = resolveFontFamily(editorSettings.fontFamily);
            root.style.setProperty('--editor-font-family', resolvedFont);
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

                    // Robust check for NodeSelection
                    if ((selection as any).node?.type.name === 'inlineMath') {
                        latex = (selection as any).node.attrs.latex;
                    } else {
                        // Otherwise use selected text
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

        // Sync default code language
        useEffect(() => {
            if (editor && !editor.isDestroyed) {
                (editor as any).setOptions('codeBlock', {
                    defaultLanguage: editorSettings.defaultCodeLanguage
                });
            }
        }, [editor, editorSettings.defaultCodeLanguage]);

        // Handle content updates (e.g. version history)
        useEffect(() => {
            if (editor && initialContent !== undefined) {
                const currentHtml = editor.getHTML();
                if (currentHtml !== initialContent) {
                    editor.commands.setContent(initialContent, { emitUpdate: false });
                }

                // Update baseline for size validation
                lastValidContentRef.current = initialContent;

                const imageIds = extractImageIds(initialContent || '');
                if (imageIds.length > 0) {
                    NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                        if (imageMap && Object.keys(imageMap).length > 0) {
                            isHydrating.current = true;
                            (editor.commands as any).resolveImages({ imageMap });
                            isHydrating.current = false;
                        }
                    });
                }
            }
        }, [editor, initialContent]);
        const sendCommand = useCallback((command: string, params: Record<string, any> = {}) => {
            if (!editor) return;

            if (dispatchEditorCommand(editor, command, params)) {
                return;
            }

            switch (command) {
                case 'setContent':
                    editor.commands.setContent(params?.content as string);
                    break;
                case 'focus':
                    editor.commands.focus();
                    break;
                case 'blur':
                    editor.commands.blur();
                    break;
                case 'insertLocalImage':
                    if (params?.imageId) {
                        editor.chain().insertContent({ type: 'image', attrs: { imageId: params.imageId } }).focus().run();
                    }
                    break;
                case 'resolveImages':
                    if (params?.imageMap) {
                        (editor.commands as any).resolveImages({ imageMap: params.imageMap });
                    }
                    break;
                case 'setDetailsBackground': {
                    let bgColor = params.color as string | null;
                    if (bgColor && bgColor.startsWith('#') && bgColor.length === 7) bgColor += '26';

                    if (params.pos !== undefined) {
                        const node = editor.state.doc.nodeAt(params.pos);
                        if (node) {
                            editor.view.dispatch(editor.state.tr.setNodeMarkup(params.pos, undefined, { ...node.attrs, backgroundColor: bgColor }));
                        }
                    } else {
                        editor.chain().updateAttributes('details', { backgroundColor: bgColor }).focus().run();
                    }
                    break;
                }
                case 'copyToClipboard':
                    if (params?.pos !== undefined) {
                        const node = editor.state.doc.nodeAt(params.pos);
                        if (node) {
                            const text = node.textContent || '';
                            window.navigator.clipboard.writeText(text);
                        }
                    } else {
                        const { from, to } = editor.state.selection;
                        const text = editor.state.doc.textBetween(from, to, '\n');
                        window.navigator.clipboard.writeText(text);
                    }
                    break;
                case 'copyDetailsContent':
                    if (params?.pos !== undefined) {
                        const node = editor.state.doc.nodeAt(params.pos);
                        if (node && node.type.name === 'details') {
                            let textToCopy = '';
                            node.forEach((child) => {
                                if (child.type.name === 'detailsContent') {
                                    textToCopy = child.textContent;
                                }
                            });
                            if (!textToCopy) textToCopy = node.textContent;
                            window.navigator.clipboard.writeText(textToCopy);
                        }
                    }
                    break;
                case 'onCommand':
                    if (params?.command && params.command !== 'onCommand') {
                        sendCommand(params.command, params.args ?? {});
                    }
                    break;
                case 'openMathModal':
                    setActivePopup('math');
                    break;
                case 'openImageModal':
                    setActivePopup('image');
                    break;
                case 'openLinkModal':
                    setActivePopup('link');
                    break;
                case 'openYoutubeModal':
                    setActivePopup('youtube');
                    break;
            }
        }, [editor]);

        useImperativeHandle(ref, () => ({
            getContent: () => Promise.resolve(editor?.getHTML() || ''),
            setContent: (content: string) => editor?.commands.setContent(content),
            focus: () => editor?.commands.focus(),
            blur: () => editor?.commands.blur(),
            onCommand: (cmd, params) => sendCommand(cmd as any, params),
            search: (term: string) => (editor?.commands as any).search(term),
            searchNext: () => (editor?.commands as any).searchNext(),
            searchPrev: () => (editor?.commands as any).searchPrev(),
            clearSearch: () => (editor?.commands as any).clearSearch(),
            scrollToElement: (id: string) => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
        }), [editor]);

        const handleInsertImage = useCallback(async (source: 'url' | 'library' | 'camera', value?: string): Promise<boolean> => {
            if (!noteId || !editor) return false;
            try {
                if (source === 'url' && value) {
                    const processed = await NoteImageService.processRemoteImage(noteId, value);
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);

                    // Atomic insert to avoid flashing placeholders
                    // We WANT this change to trigger onUpdate (for persistence)
                    editor.chain().focus().insertContent({
                        type: 'image',
                        attrs: {
                            imageId: processed.imageId,
                            src: imageMap[processed.imageId] || ''
                        }
                    }).run();
                    return true;
                } else if (source === 'library' && value) {
                    const processed = await NoteImageService.processAndInsertImage(noteId, value);
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);

                    // Atomic insert to avoid flashing placeholders
                    // We WANT this change to trigger onUpdate (for persistence)
                    editor.chain().focus().insertContent({
                        type: 'image',
                        attrs: {
                            imageId: processed.imageId,
                            src: imageMap[processed.imageId] || ''
                        }
                    }).run();
                    return true;
                }
                return false;
            } catch (err) {
                console.error('Failed to insert image:', err);
                return false;
            }
        }, [noteId, editor]);

        return (
            <div
                ref={containerRef}
                className="native-editor-container"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    height: '100%',
                    width: '100%',
                    position: 'relative',
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-color)'
                }}
            >
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
                    blockData: null,
                    onInsertMath: () => {
                        setCurrentLatex(null);
                        setActivePopup('math');
                    }
                })}

                <div className="editor-scroller" style={{
                    flex: 1,
                    overflowY: 'auto',
                    width: '100%',
                    paddingLeft: '24px',
                    paddingRight: '24px'
                }}>
                    <div style={{
                        maxWidth: 'var(--editor-max-width)',
                        margin: '0 auto',
                        height: '100%',
                        position: 'relative'
                    }}>
                        {renderHeader?.()}
                        <EditorContent editor={editor} style={{ height: '100%', outline: 'none' }} />
                    </div>
                </div>

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
NativeEditor.displayName = 'NativeEditor';
