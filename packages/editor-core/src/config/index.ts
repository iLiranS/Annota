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
import { Slice } from '@tiptap/pm/model';
import { CellSelection } from '@tiptap/pm/tables';
import { StarterKit } from '@tiptap/starter-kit';

import { Mathematics } from '@tiptap/extension-mathematics';
import {
    AnnotaAutolink,
    CustomCodeBlock,
    CustomHeading,
    CustomImage,
    CustomTableCell,
    CustomTableHeader,
    Details,
    DetailsContent,
    DetailsSummary,
    NoteLinkCommandExtension,
    FileAttachment,
    SearchExtension,
    ShortcutManager,
    SlashCommandExtension,
    TagCommandExtension
} from '../extensions';
import { CustomYoutube } from '../extensions/custom-yotube';

export const WEB_FONT_FAMILIES: Record<string, string> = {
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'FiraCode', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    monospace: "'FiraCode', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    poppins: 'Poppins',
    firacode: 'FiraCode',
    'fira code': 'FiraCode',
    'system (default)': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

export function resolveFontFamily(value?: string) {
    if (!value) return WEB_FONT_FAMILIES.system;
    const key = value.toLowerCase();
    const resolved = WEB_FONT_FAMILIES[key];
    if (resolved) return resolved;

    // If it's a custom font name with spaces, wrap in quotes for CSS safety
    if (value.includes(' ') && !value.startsWith("'") && !value.startsWith('"')) {
        return `'${value}'`;
    }
    return value;
}

export const getExtensions = (options: {
    placeholder?: string;
    editorOrigin?: string;
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
    defaultCodeLanguage?: string | null;
    onSlashCommand?: (data: any) => void;
    onTagCommand?: (data: any) => void;
    onNoteLinkCommand?: (data: any) => void;
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
        AnnotaAutolink,
        CustomHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        Underline,
        Placeholder.configure({ placeholder: options.placeholder ?? 'Write something...' }),
        Link.configure({
            openOnClick: false,
            autolink: true,
            protocols: ['http', 'https', 'mailto', 'tel', 'annota'],
            HTMLAttributes: { rel: 'noopener noreferrer' },
            validate: (href) => /^(https?:\/\/|annota:\/\/|mailto:|tel:)/i.test(href),
        }),
        Highlight.configure({ multicolor: true }),
        TextStyle,
        FontFamily.configure({
            types: ['textStyle'],
        }),
        Color,
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
        }),
        Table.configure({ resizable: true, HTMLAttributes: { class: 'editor-table' } }),
        TableRow,
        CustomTableCell,
        CustomTableHeader,
        TaskList,
        TaskItem.configure({ nested: true }),
        CustomCodeBlock.configure({
            onOpenBlockMenu: options.onOpenBlockMenu,
            onCodeBlockSelected: options.onCodeBlockSelected,
            defaultLanguage: options.defaultCodeLanguage,
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
        SlashCommandExtension.configure({
            onSlashCommand: options.onSlashCommand,
        }),
        TagCommandExtension.configure({
            onTagCommand: options.onTagCommand,
        }),
        NoteLinkCommandExtension.configure({
            onNoteLinkCommand: options.onNoteLinkCommand,
        }),
    ];

export const getEditorProps = (callbacks: {
    onScroll?: () => void;
    onContextMenu?: (view: any, event: MouseEvent) => boolean;
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
        mousedown: (view: any, event: MouseEvent) => {
            // Check if the mouse event is a right-click (button 2)
            if (event.button === 2) {
                const { state } = view;

                // Check if the current selection is a multiple cell selection
                if (state.selection instanceof CellSelection || (state.selection as any).constructor.name === 'CellSelection') {
                    // Return true to tell Tiptap we handled this event.
                    // This stops Tiptap from resetting the selection to a single cell,
                    // but still allows the 'contextmenu' event to bubble up.
                    return true;
                }
            }
            return false;
        },
        contextmenu: (view: any, event: MouseEvent) => {
            return callbacks.onContextMenu?.(view, event) || false;
        },
    },
    transformPastedHTML(html: string) {
        // Strip theme-interfering styles from pasted HTML to ensure consistency
        return html
            .replace(/font-family\s*:[^;"']*(;|(?=["']))/gi, '')
            .replace(/color\s*:[^;"']*(;|(?=["']))/gi, '')
            .replace(/background-color\s*:[^;"']*(;|(?=["']))/gi, '')
            .replace(/font-size\s*:[^;"']*(;|(?=["']))/gi, '')
            .replace(/line-height\s*:[^;"']*(;|(?=["']))/gi, '');
    },
    transformPasted(slice: Slice) {
        if (slice.content.childCount === 1) {
            const firstChild = slice.content.firstChild;
            if (firstChild && (firstChild.type.name === 'codeBlock' || firstChild.type.name === 'details')) {
                // Check if it's a partial selection from within the block
                if (slice.openStart > 0 || slice.openEnd > 0) {
                    if (firstChild.type.name === 'codeBlock') {
                        return new Slice(firstChild.content, Math.max(0, slice.openStart - 1), Math.max(0, slice.openEnd - 1));
                    }
                    if (firstChild.type.name === 'details') {
                        let innerContent = firstChild.content;
                        firstChild.content.forEach(node => {
                            if (node.type.name === 'detailsContent') {
                                innerContent = node.content;
                            }
                        });
                        return new Slice(innerContent, Math.max(0, slice.openStart - 2), Math.max(0, slice.openEnd - 2));
                    }
                }
            }
        }
        return slice;
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
        isFocused: e.isFocused,
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
        canMergeCells: isInTable && e.can().mergeCells(),
        canSplitCell: isInTable && e.can().splitCell(),
        isImage: e.isActive('image'),
        imageAttrs: e.isActive('image') ? imageAttrs : null,
        isDetails: e.isActive('details'),
        detailsBackgroundColor: e.isActive('details') ? e.getAttributes('details').backgroundColor : null,
    };
};
