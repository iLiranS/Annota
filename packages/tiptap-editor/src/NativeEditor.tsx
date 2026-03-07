import { useSettingsStore } from '@annota/core';
import { NoteImageService } from '@annota/core/platform';
import { getEditorProps, getEditorState, getExtensions, resolveFontFamily } from '@annota/editor-web/config';
import '@annota/editor-web/styles.css';
import { EditorContent, useEditor } from '@tiptap/react';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
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
        renderImageGallery,
        isDark: propIsDark,
        colors: propColors,
    }, ref) => {
        const colors = propColors || { primary: '#007AFF', background: '#FFFFFF', text: '#000000' };
        const dark = propIsDark ?? false;
        const { editor: editorSettings } = useSettingsStore();

        const [editorState, setEditorState] = useState<EditorState>(initialEditorState);
        const [isGalleryVisible, setIsGalleryVisible] = useState(false);
        const [galleryImages, setGalleryImages] = useState<ImageInfo[]>([]);
        const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);
        const containerRef = React.useRef<HTMLDivElement>(null);

        const extensions = React.useMemo(() => getExtensions({
            placeholder,
            onMathSelected: (latex, isBlock, pos) => {
                // Logic to handle math selection if needed for specifically for desktop UI
            },
            onImageSelected: (data) => {
                setGalleryImages(data.images);
                setGalleryCurrentIndex(data.currentIndex);
                setIsGalleryVisible(true);
                onGalleryVisibilityChange?.(true);
            }
        }) as any, [placeholder]);

        const editorProps = React.useMemo(() => getEditorProps({
            direction: editorSettings.direction,
            onScroll: () => {
                // In native desktop, we might not need to report cursor pos via bridge
                // but we can if the toolbar needs it.
            }
        }), [editorSettings.direction]);

        const editor = useEditor({
            editable,
            content: initialContent,
            immediatelyRender: false,
            extensions,
            editorProps,
            onCreate: ({ editor }) => {
                if (autofocus) {
                    editor.commands.focus();
                }
                setEditorState(getEditorState(editor) as EditorState);
            },
            onUpdate: ({ editor }) => {
                onContentChange?.(editor.getHTML());
                setEditorState(getEditorState(editor) as EditorState);
            },
            onSelectionUpdate: ({ editor }) => {
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

            root.style.setProperty('--bg-color', colors.background);
            root.style.setProperty('--text-color', colors.text);
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

        // Handle content updates (e.g. version history)
        useEffect(() => {
            if (editor && initialContent !== undefined) {
                const currentHtml = editor.getHTML();
                if (currentHtml !== initialContent) {
                    editor.commands.setContent(initialContent, { emitUpdate: false });
                }

                const imageIds = extractImageIds(initialContent);
                if (imageIds.length > 0) {
                    NoteImageService.resolveImageSources(imageIds).then((imageMap: any) => {
                        if (Object.keys(imageMap).length > 0) {
                            (editor.commands as any).resolveImages({ imageMap });
                        }
                    });
                }
            }
        }, [editor, initialContent]);
        const sendCommand = useCallback((command: string, params: Record<string, any> = {}) => {
            if (!editor) return;

            // Map legacy string commands to Tiptap commands
            const c = editor.chain().focus() as any;

            switch (command) {
                case 'toggleBold': c.toggleBold().run(); break;
                case 'toggleItalic': c.toggleItalic().run(); break;
                case 'toggleUnderline': c.toggleUnderline().run(); break;
                case 'toggleStrike': c.toggleStrike().run(); break;
                case 'toggleCode': c.toggleCode().run(); break;
                case 'toggleBlockquote': c.toggleBlockquote().run(); break;
                case 'toggleBulletList': c.toggleBulletList().run(); break;
                case 'toggleOrderedList': c.toggleOrderedList().run(); break;
                case 'toggleTaskList': c.toggleTaskList().run(); break;
                case 'sinkListItem': c.sinkListItem('listItem').run(); break;
                case 'liftListItem': c.liftListItem('listItem').run(); break;
                case 'undo': c.undo().run(); break;
                case 'redo': c.redo().run(); break;
                case 'setHeading': c.toggleHeading({ level: params.level as any }).run(); break;
                case 'setParagraph': c.setParagraph().run(); break;
                case 'setColor': c.setColor(params.color as string).run(); break;
                case 'unsetColor': c.unsetColor().run(); break;
                case 'setHighlight': c.setHighlight({ color: params.color as string }).run(); break;
                case 'unsetHighlight': c.unsetHighlight().run(); break;
                case 'insertTable': c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
                case 'addColumnBefore': c.addColumnBefore().run(); break;
                case 'addColumnAfter': c.addColumnAfter().run(); break;
                case 'deleteColumn': c.deleteColumn().run(); break;
                case 'addRowBefore': c.addRowBefore().run(); break;
                case 'addRowAfter': c.addRowAfter().run(); break;
                case 'deleteRow': c.deleteRow().run(); break;
                case 'deleteTable': c.deleteTable().run(); break;
                case 'setLink': c.setLink({ href: params.href as string }).run(); break;
                case 'unsetLink': c.unsetLink().run(); break;
                case 'insertImage': c.setImage({ src: params.src as string }).run(); break;
                case 'insertLocalImage':
                    if (params.imageId) {
                        c.insertContent(`<img data-image-id="${params.imageId}" />`).run();
                    }
                    break;
                case 'resolveImages':
                    if (params.imageMap) {
                        (editor.commands as any).resolveImages({ imageMap: params.imageMap });
                    }
                    break;
                case 'setContent':
                    editor.commands.setContent(params.content as string);
                    break;
                case 'focus': editor.commands.focus(); break;
                case 'blur': editor.commands.blur(); break;
            }
        }, [editor]);

        useImperativeHandle(ref, () => ({
            getContent: () => Promise.resolve(editor?.getHTML() || ''),
            setContent: (content: string) => editor?.commands.setContent(content),
            focus: () => editor?.commands.focus(),
            blur: () => editor?.commands.blur(),
            search: (term: string) => (editor?.commands as any).setSearchTerm(term),
            searchNext: () => (editor?.commands as any).goToNextSearchResult(),
            searchPrev: () => (editor?.commands as any).goToPrevSearchResult(),
            clearSearch: () => (editor?.commands as any).clearSearchTerm(),
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
                    editor.chain().focus().insertContent(`<img data-image-id="${processed.imageId}" />`).run();
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    (editor.commands as any).resolveImages({ imageMap });
                    return true;
                } else if (source === 'library' && value) {
                    const processed = await NoteImageService.processAndInsertImage(noteId, value);
                    editor.chain().focus().insertContent(`<img data-image-id="${processed.imageId}" />`).run();
                    const imageMap = await NoteImageService.resolveImageSources([processed.imageId]);
                    (editor.commands as any).resolveImages({ imageMap });
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
                    backgroundColor: colors.background,
                    color: colors.text
                }}
            >
                {renderToolbar?.({
                    editorState,
                    sendCommand,
                    onCommand: sendCommand,
                    toolbarHeight: 0,
                    onDismissKeyboard: () => { },
                    activePopup: null,
                    onActivePopupChange: () => { },
                    onPopupStateChange: () => { },
                    onInsertImage: handleInsertImage,
                    currentLatex: null,
                    blockData: null,
                    onInsertMath: () => { }
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
                        height: '100%'
                    }}>
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
