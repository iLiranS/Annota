import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { FontFamily, TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { Youtube } from '@tiptap/extension-youtube';
import { StarterKit } from '@tiptap/starter-kit';

import { Mathematics } from '@tiptap/extension-mathematics';
import {
    CustomCodeBlock,
    CustomHeading,
    CustomImage,
    CustomTableCell,
    CustomTableHeader,
    Details,
    DetailsContent,
    DetailsSummary,
    SearchExtension,
    ShortcutManager
} from './extensions';

export const WEB_FONT_FAMILIES: Record<string, string> = {
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    poppins: 'Poppins',
    varela: 'VarelaRound',
    'varela round': 'VarelaRound',
    'system (default)': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export function resolveFontFamily(value?: string) {
    if (!value) return WEB_FONT_FAMILIES.system;
    const key = value.toLowerCase();
    return WEB_FONT_FAMILIES[key] ?? value;
}

export const getExtensions = (options: {
    placeholder?: string;
    editorOrigin?: string;
    onMathSelected?: (latex: string, isBlock: boolean, pos: number) => void;
    onImageSelected?: (data: { images: any[], currentIndex: number }) => void;
    onSearchResults?: (count: number, currentIndex: number) => void;
    onOpenBlockMenu?: (e: MouseEvent, resolve: () => any) => void;
    onOpenImageMenu?: (e: MouseEvent, resolve: () => any) => void;
}) => [
        StarterKit.configure({
            heading: false,
            codeBlock: false,
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
        ShortcutManager,
        CustomHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        Underline,
        Placeholder.configure({ placeholder: options.placeholder ?? 'Write something...' }),
        Link.configure({
            openOnClick: false,
            protocols: ['http', 'https', 'mailto', 'tel', 'annota'],
            HTMLAttributes: { rel: 'noopener noreferrer' },
        }),
        Highlight.configure({ multicolor: true }),
        TextStyle,
        FontFamily.configure({
            types: ['textStyle'],
        }),
        Color,
        Youtube.configure({
            width: 320,
            height: 180,
            nocookie: true,
            origin: options.editorOrigin || undefined,
            HTMLAttributes: {
                referrerPolicy: 'strict-origin-when-cross-origin' as any,
                playsinline: 'true',
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            },
        }),
        CustomImage.configure({
            inline: false,
            allowBase64: true,
            onImageSelected: options.onImageSelected,
            onOpenImageMenu: options.onOpenImageMenu,
        }),
        Table.configure({ resizable: true, HTMLAttributes: { class: 'editor-table' } }),
        TableRow,
        CustomTableCell,
        CustomTableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        CustomCodeBlock.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
        }),
        // @ts-ignore - Type mismatch due to tiptap version difference between packages
        Details,
        // @ts-ignore - Type mismatch due to tiptap version difference between packages
        DetailsSummary.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
        }),
        // @ts-ignore - Type mismatch due to tiptap version difference between packages
        DetailsContent,
        Mathematics.configure({
            katexOptions: {
                throwOnError: false,
                output: 'html',
            },
            inlineOptions: {
                onClick: (node, pos) => {
                    options.onMathSelected?.(node.attrs.latex, false, pos);
                }
            },
            blockOptions: {
                onClick: (node, pos) => {
                    options.onMathSelected?.(node.attrs.latex, true, pos);
                }
            }
        }),
        SearchExtension.configure({
            onResults: (data: any) => {
                options.onSearchResults?.(data.count, data.currentIndex);
            }
        }),
    ];

export const getEditorProps = (callbacks: {
    onScroll?: () => void;
    direction?: string;
}) => ({
    attributes: { dir: callbacks.direction || 'auto' },
    handleScrollToSelection: () => {
        callbacks.onScroll?.();
        return true; // prevent default tiptap scrolling
    },
    handleDOMEvents: {
        drop: () => false,
        dragover: () => false,
        dragstart: () => false,
    },
    transformPastedHTML(html: string) {
        // Strip font-family from inline styles so pasted content
        // inherits the editor's configured font
        return html.replace(/font-family\s*:[^;"']*(;|(?=["']))/gi, '');
    },
});

export const getEditorState = (editor: any) => {
    if (!editor) return {};
    const e = editor;
    const highlightAttrs = e.getAttributes('highlight');
    const textStyleAttrs = e.getAttributes('textStyle');
    const linkAttrs = e.getAttributes('link');
    const imageAttrs = e.getAttributes('image');

    const isInTable = e.isActive('table');
    const isCodeBlock = e.isActive('codeBlock');
    const codeBlockAttrs = e.getAttributes('codeBlock');

    const { from, to } = e.state.selection;
    const selectedText = from !== to ? e.state.doc.textBetween(from, to, ' ') : '';
    const headingAttrs = e.isActive('heading') ? e.getAttributes('heading') : null;

    return {
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isUnderline: e.isActive('underline'),
        isStrike: e.isActive('strike'),
        isTaskList: e.isActive('taskList'),
        isCode: e.isActive('code'),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        canSinkListItem: e.can().sinkListItem('listItem'),
        canLiftListItem: e.can().liftListItem('listItem'),
        isBlockquote: e.isActive('blockquote'),
        isCodeBlock,
        currentCodeLanguage: isCodeBlock ? (codeBlockAttrs.language || null) : null,
        isHeading1: e.isActive('heading', { level: 1 }),
        isHeading2: e.isActive('heading', { level: 2 }),
        isHeading3: e.isActive('heading', { level: 3 }),
        isHeading4: e.isActive('heading', { level: 4 }),
        isHeading5: e.isActive('heading', { level: 5 }),
        isHeading6: e.isActive('heading', { level: 6 }),
        currentHeadingLevel: headingAttrs?.level ?? null,
        currentHeadingId: headingAttrs?.id ?? null,
        isLink: e.isActive('link'),
        linkHref: linkAttrs.href || null,
        selectedText,
        highlightColor: highlightAttrs.color || null,
        textColor: textStyleAttrs.color || null,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        isInTable,
        canAddRowBefore: isInTable && e.can().addRowBefore(),
        canAddRowAfter: isInTable && e.can().addRowAfter(),
        canAddColumnBefore: isInTable && e.can().addColumnBefore(),
        canAddColumnAfter: isInTable && e.can().addColumnAfter(),
        canDeleteRow: isInTable && e.can().deleteRow(),
        canDeleteColumn: isInTable && e.can().deleteColumn(),
        canDeleteTable: isInTable && e.can().deleteTable(),
        isImage: e.isActive('image'),
        imageAttrs: e.isActive('image') ? imageAttrs : null,
        isDetails: e.isActive('details'),
        detailsBackgroundColor: e.isActive('details') ? e.getAttributes('details').backgroundColor : null,
    };
};
