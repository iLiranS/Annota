import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import { columnResizing, tableEditing } from '@tiptap/pm/tables';
import { Table, TableView } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import type { TableOptions } from '@tiptap/extension-table';

interface CustomTableOptions extends TableOptions {
    defaultCellMinWidth: number;
}

const getColStyleDeclaration = (minWidth: number, width?: number): [string, string] => {
    if (width) {
        return ['width', `${Math.max(width, minWidth)}px`];
    }

    return ['min-width', `${minWidth}px`];
};

const updateColumns = (
    node: ProseMirrorNode,
    colgroup: HTMLTableColElement,
    table: HTMLTableElement,
    minCellWidth: number,
    overrideCol?: number,
    overrideValue?: number,
) => {
    let totalWidth = 0;
    let fixedWidth = true;
    let nextDOM = colgroup.firstChild;
    const row = node.firstChild;

    if (row !== null) {
        for (let i = 0, col = 0; i < row.childCount; i += 1) {
            const { colspan, colwidth } = row.child(i).attrs;
            for (let j = 0; j < colspan; j += 1, col += 1) {
                const explicitWidth =
                    overrideCol === col ? overrideValue : (colwidth && (colwidth[j] as number | undefined));

                // If there's an explicit width (like when the user has resized the column), use it.
                // Otherwise do not supply a default - let the table automatically size itself based on contents.
                const resolvedWidth = explicitWidth;

                totalWidth += resolvedWidth || minCellWidth;

                if (!resolvedWidth) {
                    fixedWidth = false;
                }

                if (!nextDOM) {
                    const colElement = document.createElement('col');
                    if (resolvedWidth) {
                        const [propertyKey, propertyValue] = getColStyleDeclaration(minCellWidth, resolvedWidth);
                        colElement.style.setProperty(propertyKey, propertyValue);
                    } else {
                        colElement.style.minWidth = `${minCellWidth}px`;
                    }
                    colgroup.appendChild(colElement);
                } else {
                    const colElement = nextDOM as HTMLTableColElement;
                    if (resolvedWidth) {
                        const [propertyKey, propertyValue] = getColStyleDeclaration(minCellWidth, resolvedWidth);
                        colElement.style.setProperty(propertyKey, propertyValue);
                    } else {
                        colElement.style.width = '';
                        colElement.style.minWidth = `${minCellWidth}px`;
                    }
                    nextDOM = nextDOM.nextSibling;
                }
            }
        }
    }

    while (nextDOM) {
        const after = nextDOM.nextSibling;

        nextDOM.parentNode?.removeChild(nextDOM);
        nextDOM = after;
    }

    const hasUserWidth =
        node.attrs.style && typeof node.attrs.style === 'string' && /\bwidth\s*:/i.test(node.attrs.style);

    if (fixedWidth && !hasUserWidth) {
        table.style.width = `${totalWidth}px`;
        table.style.minWidth = '';
    } else {
        table.style.width = '';
        table.style.minWidth = `${totalWidth}px`;
    }
};

class CustomTableView implements NodeView {
    node: ProseMirrorNode;
    minCellWidth: number;
    defaultCellWidth: number;
    dom: HTMLDivElement;
    table: HTMLTableElement;
    colgroup: HTMLTableColElement;
    contentDOM: HTMLTableSectionElement;

    constructor(node: ProseMirrorNode, defaultCellWidth: number, minCellWidth: number) {
        this.node = node;
        this.minCellWidth = minCellWidth;
        this.defaultCellWidth = defaultCellWidth;
        this.dom = document.createElement('div');
        this.dom.className = 'tableWrapper';
        this.table = this.dom.appendChild(document.createElement('table'));

        if (node.attrs.style) {
            this.table.style.cssText = node.attrs.style;
        }

        this.colgroup = this.table.appendChild(document.createElement('colgroup'));
        updateColumns(node, this.colgroup, this.table, this.minCellWidth);
        this.contentDOM = this.table.appendChild(document.createElement('tbody'));
    }

    update(node: ProseMirrorNode) {
        if (node.type !== this.node.type) {
            return false;
        }

        this.node = node;
        updateColumns(node, this.colgroup, this.table, this.minCellWidth);

        return true;
    }

    ignoreMutation(mutation: ViewMutationRecord) {
        const target = mutation.target as Node;
        const isInsideWrapper = this.dom.contains(target);
        const isInsideContent = this.contentDOM.contains(target);

        if (isInsideWrapper && !isInsideContent) {
            if (mutation.type === 'attributes' || mutation.type === 'childList' || mutation.type === 'characterData') {
                return true;
            }
        }

        return false;
    }
}

export const CustomTable = Table.extend<CustomTableOptions>({
    addOptions() {
        const parent = this.parent?.();
        const base: TableOptions = parent ?? {
            HTMLAttributes: {},
            resizable: false,
            renderWrapper: false,
            handleWidth: 5,
            cellMinWidth: 25,
            View: TableView,
            lastColumnResizable: true,
            allowTableNodeSelection: false,
        };

        return {
            ...base,
            HTMLAttributes: base.HTMLAttributes ?? {},
            defaultCellMinWidth: base.cellMinWidth,
        };
    },
    addProseMirrorPlugins() {
        const isResizable = this.options.resizable && this.editor.isEditable;
        const minCellWidth = this.options.cellMinWidth ?? 25;
        const defaultCellWidth = this.options.defaultCellMinWidth ?? minCellWidth;

        const TableViewWithDefaults = class extends CustomTableView {
            constructor(node: ProseMirrorNode, cellWidth: number, _view?: EditorView) {
                super(node, cellWidth, minCellWidth);
            }
        };

        return [
            ...(isResizable
                ? [
                    columnResizing({
                        handleWidth: this.options.handleWidth,
                        cellMinWidth: minCellWidth,
                        defaultCellMinWidth: defaultCellWidth,
                        View: TableViewWithDefaults,
                        lastColumnResizable: this.options.lastColumnResizable,
                    }),
                ]
                : []),
            tableEditing({
                allowTableNodeSelection: this.options.allowTableNodeSelection,
            }),
        ];
    },
    addKeyboardShortcuts() {
        return {
            'Mod-Enter': () => this.editor.commands.addRowAfter(),
            'Shift-Mod-Enter': () => this.editor.commands.addRowBefore(),
            'Alt-Mod-Enter': () => this.editor.commands.addColumnBefore(),
            'Shift-Alt-Mod-Enter': () => this.editor.commands.addColumnAfter(),
            'Tab': () => this.editor.commands.goToNextCell(),
            'Shift-Tab': () => this.editor.commands.goToPreviousCell(),
        };
    },
});

export const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                renderHTML: attrs => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
                parseHTML: element => element.style.backgroundColor || null,
            },
        };
    },
});

export const CustomTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                renderHTML: attrs => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
                parseHTML: element => element.style.backgroundColor || null,
            },
        };
    },
});
