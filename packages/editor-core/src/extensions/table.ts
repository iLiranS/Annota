import { mergeAttributes } from '@tiptap/core';
import type { TableOptions } from '@tiptap/extension-table';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { columnResizing, tableEditing } from '@tiptap/pm/tables';
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import './table.css';

interface CustomTableOptions extends TableOptions {
    defaultCellWidth: number;
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
    // defaultCellWidth is the fallback when no colwidth has been stored yet.
    // Without this, unsized columns only contribute minCellWidth to totalWidth,
    // causing the table to snap to a tiny width on first resize.
    defaultCellWidth: number,
    overrideCol?: number,
    overrideValue?: number,
) => {
    let totalWidth = 0;
    let nextDOM = colgroup.firstChild;
    const row = node.firstChild;

    if (row !== null) {
        for (let i = 0, col = 0; i < row.childCount; i += 1) {
            const { colspan, colwidth } = row.child(i).attrs;
            for (let j = 0; j < colspan; j += 1, col += 1) {
                const resolvedWidth: number | undefined =
                    overrideCol === col ? overrideValue : (colwidth && (colwidth[j] as number | undefined));

                totalWidth += resolvedWidth ?? defaultCellWidth;

                if (!nextDOM) {
                    const col = document.createElement('col');
                    if (resolvedWidth) {
                        const [prop, val] = getColStyleDeclaration(minCellWidth, resolvedWidth);
                        col.style.setProperty(prop, val);
                    } else {
                        col.style.width = `${defaultCellWidth}px`;
                        col.style.minWidth = `${minCellWidth}px`;
                    }
                    colgroup.appendChild(col);
                } else {
                    const col = nextDOM as HTMLTableColElement;
                    if (resolvedWidth) {
                        const [prop, val] = getColStyleDeclaration(minCellWidth, resolvedWidth);
                        col.style.setProperty(prop, val);
                    } else {
                        col.style.width = `${defaultCellWidth}px`;
                        col.style.minWidth = `${minCellWidth}px`;
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

    // Always a hard pixel width — never % or min-width — so overflow-x: auto
    // on the wrapper can scroll instead of the browser clamping to viewport.
    table.style.width = `${totalWidth}px`;
    table.style.minWidth = `${totalWidth}px`;
    table.style.maxWidth = 'none';
};

class CustomTableView implements NodeView {
    node: ProseMirrorNode;
    minCellWidth: number;
    defaultCellWidth: number;
    dom: HTMLDivElement;
    table: HTMLTableElement;
    colgroup: HTMLTableColElement;
    contentDOM: HTMLTableSectionElement;
    view: EditorView;
    getPos: () => number | undefined;

    constructor(node: ProseMirrorNode, minCellWidth: number, view: EditorView, getPos?: () => number | undefined, defaultCellWidth?: number) {
        this.node = node;
        this.minCellWidth = minCellWidth;
        this.defaultCellWidth = defaultCellWidth ?? 128;
        this.view = view;
        this.getPos = getPos || (() => undefined);
        this.dom = document.createElement('div');
        this.dom.className = 'tableWrapper';

        // --- Selection Gutter ---
        const gutter = document.createElement('div');
        gutter.className = 'block-selection-gutter';
        this.dom.appendChild(gutter);

        this.table = this.dom.appendChild(document.createElement('table'));
        this.colgroup = this.table.appendChild(document.createElement('colgroup'));

        updateColumns(node, this.colgroup, this.table, this.minCellWidth, this.defaultCellWidth);
        this.contentDOM = this.table.appendChild(document.createElement('tbody'));

        // --- Mobile Selection Support ---
        let touchStartTime = 0;
        let touchStartY = 0;

        this.dom.addEventListener('touchstart', (e: TouchEvent) => {
            touchStartTime = Date.now();
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        this.dom.addEventListener('touchend', (e: TouchEvent) => {
            const elapsed = Date.now() - touchStartTime;
            const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);

            // Short tap with minimal movement = selection intent
            if (elapsed < 500 && deltaY < 10) {
                const pos = typeof this.getPos === 'function' ? this.getPos() : undefined;
                if (typeof pos !== 'number') return;

                const { state, dispatch } = this.view;
                // Tapping a table selects the first cell (pos + 1), not the table node itself
                const tr = state.tr.setSelection(TextSelection.create(state.doc, pos + 1));
                dispatch(tr);
            }
        }, { passive: true });
    }

    update(node: ProseMirrorNode) {
        if (node.type !== this.node.type) {
            return false;
        }

        this.node = node;
        updateColumns(node, this.colgroup, this.table, this.minCellWidth, this.defaultCellWidth);

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

const createTableView = (_minCellWidth: number, defaultCellWidth: number) =>
    class extends CustomTableView {
        constructor(node: ProseMirrorNode, cellMinWidth: number, view: EditorView, getPos?: () => number | undefined) {
            super(node, cellMinWidth, view, getPos, defaultCellWidth);
        }
    };

const guardResizeEvents = (plugin: Plugin) => {
    const events = plugin.props.handleDOMEvents;

    if (!events) {
        return plugin;
    }

    for (const eventName of ['mousemove', 'mouseleave', 'mousedown'] as const) {
        const handler = events[eventName];

        if (!handler) {
            continue;
        }

        events[eventName] = function (this: Plugin, view: EditorView, event: MouseEvent) {
            if (!view.editable) {
                return false;
            }

            return handler.call(this, view, event);
        };
    }

    return plugin;
};

export const CustomTable = Table.extend<CustomTableOptions>({
    addOptions() {
        const parentOptions = this.parent?.();
        return {
            resizable: false,
            handleWidth: 5,
            cellMinWidth: 64,
            lastColumnResizable: true,
            allowTableNodeSelection: false,
            renderWrapper: false,
            ...parentOptions,
            View: CustomTableView, // Always use our view to rebuild colgroup
            HTMLAttributes: parentOptions?.HTMLAttributes ?? {},
            defaultCellWidth: 64,
        };
    },

    // Only keep colwidth (needed for column resizing); drop style/dir from storage.
    addAttributes() {
        return {
            // colwidth lives on cells, not the table — no table-level attrs needed.
        };
    },

    // Emit the leanest possible HTML: just <table><tbody>…</tbody></table>.
    // All visual layout (colgroup, inline widths) is rebuilt by CustomTableView at
    // render time — it never touches storage, exactly like the YouTube NodeView.
    renderHTML({ HTMLAttributes }) {
        return [
            'table',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            ['tbody', 0],
        ];
    },

    // Parse plain <table> tags (covers all legacy formats automatically).
    parseHTML() {
        return [{ tag: 'table' }];
    },

    addProseMirrorPlugins() {
        const minCellWidth = this.options.cellMinWidth ?? 25;
        const defaultCellWidth = this.options.defaultCellWidth ?? 128;
        const View = createTableView(minCellWidth, defaultCellWidth);
        const tableViewPlugin = this.options.resizable
            ? guardResizeEvents(columnResizing({
                handleWidth: this.options.handleWidth,
                cellMinWidth: minCellWidth,
                defaultCellMinWidth: defaultCellWidth,
                View,
                lastColumnResizable: this.options.lastColumnResizable,
            }))
            : new Plugin({
                props: {
                    nodeViews: {
                        table: (node, view, getPos) => new (View as any)(node, minCellWidth, view, getPos),
                    },
                },
            });

        return [
            tableViewPlugin,
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

    // Omit colspan/rowspan/colwidth when at defaults to keep storage minimal.
    renderHTML({ HTMLAttributes }) {
        const { colspan, rowspan, colwidth, ...rest } = HTMLAttributes;
        const attrs: Record<string, unknown> = { ...rest };
        if (colspan && colspan !== 1) attrs.colspan = colspan;
        if (rowspan && rowspan !== 1) attrs.rowspan = rowspan;
        if (colwidth) attrs.colwidth = (colwidth as number[]).join(',');
        return ['td', mergeAttributes(this.options.HTMLAttributes, attrs), 0];
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

    // Same omission logic for header cells.
    renderHTML({ HTMLAttributes }) {
        const { colspan, rowspan, colwidth, ...rest } = HTMLAttributes;
        const attrs: Record<string, unknown> = { ...rest };
        if (colspan && colspan !== 1) attrs.colspan = colspan;
        if (rowspan && rowspan !== 1) attrs.rowspan = rowspan;
        if (colwidth) attrs.colwidth = (colwidth as number[]).join(',');
        return ['th', mergeAttributes(this.options.HTMLAttributes, attrs), 0];
    },
});
