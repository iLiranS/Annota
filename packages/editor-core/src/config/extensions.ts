import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TableRow } from '@tiptap/extension-table-row';
import { FontFamily } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { StarterKit } from '@tiptap/starter-kit';

import {
    AnnotaAutolink,
    CustomCodeBlock,
    CustomColor,
    CustomHeading,
    CustomHighlight,
    CustomImage,
    CustomTable,
    CustomTableCell,
    CustomTableHeader,
    CustomTextStyle,
    CustomTaskItem,
    Details,
    DetailsContent,
    DetailsSummary,
    FileAttachment,
    FlashcardBlock,
    Indentation,
    ListItemReorder,
    Mermaid,
    NoteLinkCommandExtension,
    Quote,
    SearchExtension,
    SelectionManager,
    ShortcutManager,
    SlashCommandExtension,
    TagCommandExtension,
    lowlight
} from '../extensions';
import { CustomBulletList, CustomOrderedList, CustomTaskList } from '../extensions/custom-lists';
import { CustomParagraph } from '../extensions/custom-paragraph';
import { CustomYoutube } from '../extensions/custom-yotube';
import { CustomMathematics } from './math';
import { isDesktop } from './shared';

export const getBaseExtensions = (options: {
    placeholder?: string;
    editorOrigin?: string;
    direction?: string;
    onMathSelected?: (latex: string, isBlock: boolean, pos: number) => void;
    onImageSelected?: (data: { images: any[], currentIndex: number }) => void;
    onOpenFile?: (data: { localPath: string; mimeType: string }) => void;
    onSearchResults?: (count: number, currentIndex: number) => void;
    onOpenBlockMenu?: (e: MouseEvent, resolve: () => any) => void;
    onOpenFileMenu?: (e: MouseEvent, resolve: () => any) => void;
    onOpenTableMenu?: (e: MouseEvent, resolve: () => any) => void;
    onCodeBlockSelected?: (e: MouseEvent, resolve: () => any) => void;
    onImagePasted?: (data: { base64: string, imageId?: string, src?: string }) => void;
    onResolveImageIds?: (data: { imageIds: string[] }) => void;
    onFilePasted?: (data: { localPath: string }) => void;
    defaultCodeLanguage?: string | null;
    onSlashCommand?: (data: any) => void;
    onTagCommand?: (data: any) => void;
    onNoteLinkCommand?: (data: any) => void;
}) => {
    return [
        StarterKit.configure({
            heading: false,
            codeBlock: false,
            blockquote: false,
            paragraph: false,
            bulletList: false,
            orderedList: false,
            // @ts-ignore - Some versions of StarterKit might include these
            link: false,
            // @ts-ignore - Some versions of StarterKit might include these
            underline: false,
            dropcursor: {
                color: 'var(--accent-color)',
                width: 2,
            },
            // @ts-ignore - Type mismatch between packages
            gapcursor: true,
        }),
        Indentation,
        SelectionManager,
        ShortcutManager,
        ListItemReorder,
        AnnotaAutolink,
        CustomParagraph,
        CustomHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        CustomBulletList,
        CustomOrderedList,
        Underline,
        Placeholder.configure({ placeholder: options.placeholder ?? 'Write something...' }),
        Link.configure({
            openOnClick: false,
            autolink: true,
            protocols: ['http', 'https', 'mailto', 'tel', 'annota'],
            HTMLAttributes: { rel: 'noopener noreferrer' },
            validate: (href) => /^(https?:\/\/|annota:\/\/|mailto:|tel:)/i.test(href),
        }),
        CustomHighlight.configure({ multicolor: true }),
        CustomTextStyle,
        FontFamily.configure({
            types: ['textStyle'],
        }),
        CustomColor,
        CustomYoutube.configure({}),
        CustomImage.configure({
            inline: false,
            allowBase64: true,
            onImageSelected: options.onImageSelected,
            onOpenFileMenu: options.onOpenFileMenu,
            onImagePasted: options.onImagePasted,
            onResolveImageIds: options.onResolveImageIds,
        }),
        FileAttachment.configure({
            onOpenFile: options.onOpenFile,
            onOpenFileMenu: options.onOpenFileMenu,
            onFilePasted: options.onFilePasted,
        }),
        CustomTable.configure({
            resizable: true,
            cellMinWidth: 32,
            defaultCellWidth: 128,
            renderWrapper: true,
            HTMLAttributes: { class: 'editor-table' },
        }),
        TableRow,
        CustomTableCell,
        CustomTableHeader,
        CustomTaskList,
        CustomTaskItem.configure({ nested: true }),
        CustomCodeBlock.configure({
            lowlight,
            onOpenBlockMenu: options.onOpenBlockMenu,
            onCodeBlockSelected: options.onCodeBlockSelected,
            defaultLanguage: options.defaultCodeLanguage || null,
        }),
        // @ts-ignore - Type mismatch due to tiptap version difference between packages
        Details,
        // @ts-ignore - Type mismatch due to tiptap version difference between packages
        DetailsSummary.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
        }),
        // @ts-ignore - Type mismatch due to tiptap version difference between packages
        DetailsContent,
        Quote.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
        }),
        CustomMathematics.configure({
            katexOptions: {
                throwOnError: false,
                output: 'html',
            },
            inlineOptions: {
                onClick: (node: any, pos: number) => {
                    options.onMathSelected?.(node.attrs.latex, false, pos);
                }
            },
            blockOptions: {
                onClick: (node: any, pos: number) => {
                    options.onMathSelected?.(node.attrs.latex, true, pos);
                }
            }
        }),
        SearchExtension.configure({
            onResults: (data: any) => {
                options.onSearchResults?.(data.count, data.currentIndex);
            }
        }),
        SlashCommandExtension.configure({
            onSlashCommand: options.onSlashCommand,
        }),
        TagCommandExtension.configure({
            onTagCommand: options.onTagCommand,
        }),
        NoteLinkCommandExtension.configure({
            onNoteLinkCommand: options.onNoteLinkCommand,
        }),
        Mermaid.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
        }),
        FlashcardBlock.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
        }),
    ];
};

export const getExtensions = async (options: Parameters<typeof getBaseExtensions>[0]) => {
    const extensions = getBaseExtensions(options);

    if (isDesktop) {
        try {
            const { DragHandle } = await import('@tiptap/extension-drag-handle');
            extensions.push(
                DragHandle.configure({
                    render() {
                        const el = document.createElement('div');
                        // Set inline visibility hidden initially so that the CSS selector
                        // not([style*="visibility: hidden"]) correctly matches it as hidden
                        // and prevents showing it at top-left before the first hover/recalculation.
                        el.style.visibility = 'hidden';
                        el.classList.add('annota-drag-handle');
                        if (options.direction === 'rtl') {
                            el.classList.add('rtl');
                        }
                        el.setAttribute('aria-label', 'Drag to reorder block');
                        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 16" width="10" height="16" fill="currentColor"><circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/><circle cx="3" cy="6" r="1.2"/><circle cx="7" cy="6" r="1.2"/><circle cx="3" cy="10" r="1.2"/><circle cx="7" cy="10" r="1.2"/><circle cx="3" cy="14" r="1.2"/><circle cx="7" cy="14" r="1.2"/></svg>`;

                        el.addEventListener('dragstart', () => {
                            (globalThis as any).__annotaDragBlock?.setDragging(true);
                        });
                        return el;
                    },
                    computePositionConfig: {
                        placement: options.direction === 'rtl' ? 'right-start' : 'left-start',
                        strategy: 'absolute',
                    },
                    onNodeChange({ node, editor: _editor }) {

                        // Always clear previous hover class first — this is safe outside
                        // contenteditable and does not disturb the browser's text selection.
                        document.querySelectorAll('.drag-handle-hover').forEach(el => {
                            el.classList.remove('drag-handle-hover');
                        });

                        if (!node) return;

                        // Only mutate classes on nodes *inside* the editor when the selection
                        // is collapsed; mutating contenteditable DOM during a range-selection
                        // cancels the selection in some browsers.
                        if (!_editor.state.selection.empty) return;

                        _editor.state.doc.descendants((docNode, pos) => {
                            if (docNode === node) {
                                const dom = _editor.view.nodeDOM(pos) as HTMLElement | null;
                                if (dom instanceof HTMLElement) {
                                    dom.classList.add('drag-handle-hover');
                                }
                                return false;
                            }
                            return true;
                        });
                    },
                    onElementDragEnd() {
                        document.querySelectorAll('.drag-handle-hover').forEach(el => {
                            el.classList.remove('drag-handle-hover');
                        });
                        (globalThis as any).__annotaDragBlock?.setDragging(false);
                    },
                })
            );
        } catch (e) {
            console.warn('Failed to load DragHandle extension:', e);
        }
    }

    return extensions;
};
