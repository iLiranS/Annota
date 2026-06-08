import { DOMSerializer } from '@tiptap/pm/model';
import { CellSelection } from '@tiptap/pm/tables';
import { prepareMarksHTMLForClipboard } from '../extensions';
import { getPlainTextFromFragment } from './math';

export const getEditorState = (editor: any) => {
    if (!editor) return {};
    const e = editor;
    const highlightAttrs = e.getAttributes('highlight');
    const textStyleAttrs = e.getAttributes('textStyle');
    let linkAttrs = e.getAttributes('link');

    // Robust fallback: if Tiptap's getAttributes is empty, manually check selection boundaries
    if (!linkAttrs.href) {
        const { selection } = e.state;
        const $pos = selection.$from;
        const mark = $pos.marks().find((m: any) => m.type.name === 'link');
        if (mark) linkAttrs = mark.attrs;
    }

    const imageAttrs = e.getAttributes('image');

    const isInTable = e.isActive('table');
    const isCodeBlock = e.isActive('codeBlock');
    const codeBlockAttrs = e.getAttributes('codeBlock');

    const { from, to } = e.state.selection;
    const selection = e.state.selection;
    const isCellSelection = selection instanceof CellSelection || (selection as any).constructor.name === 'CellSelection';

    let selectedHtml = '';
    let selectedText = '';

    if (from !== to || isCellSelection) {
        const slice = selection.content();
        const fragment = DOMSerializer.fromSchema(e.schema).serializeFragment(slice.content);
        const div = document.createElement('div');
        div.appendChild(fragment);
        selectedHtml = prepareMarksHTMLForClipboard(div.innerHTML);
        selectedText = getPlainTextFromFragment(slice.content);
    }

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
        canIndent: e.can().indent(),
        canOutdent: e.can().outdent(),
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
        selectedHtml,
        selectionRange: { from, to },
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
