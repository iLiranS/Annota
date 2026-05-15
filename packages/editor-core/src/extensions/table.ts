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

const updateColumns = (
    node: ProseMirrorNode,
    colgroup: HTMLTableColElement,
    table: HTMLTableElement,
    minCellWidth: number,
    defaultCellWidth: number,
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
                const storedWidth =
                    overrideCol === col
                        ? overrideValue
                        : colwidth?.[j];

                const hasWidth = typeof storedWidth === 'number' && storedWidth > 0 ? storedWidth : undefined;
                const cssWidth = hasWidth ? `${Math.max(hasWidth, minCellWidth)}px` : '';
                
                totalWidth += hasWidth || minCellWidth;
                
                if (!hasWidth) {
                    fixedWidth = false;
                }

                if (!nextDOM) {
                    const colEl = document.createElement('col');
                    colEl.style.width = cssWidth;
                    colgroup.appendChild(colEl);
                } else {
                    const colEl = nextDOM as HTMLTableColElement;
                    if (colEl.style.width !== cssWidth) {
                        colEl.style.width = cssWidth;
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

    if (fixedWidth) {
        table.style.width = `${totalWidth}px`;
        table.style.minWidth = '';
    } else {
        table.style.width = '';
        table.style.minWidth = `${totalWidth}px`;
    }
    table.style.maxWidth = 'none';
};

/**
 * Returns true if ANY cell in the table already has a stored colwidth.
 *
 * We use "any" rather than "all" intentionally: once the user has manually
 * resized even one column, the resize transaction writes colwidth onto that
 * cell. If we then re-trigger auto-measurement (because other cells still lack
 * widths), we overwrite the user's manual resize. Treating any stored width as
 * "this table has been touched" prevents that snap-back.
 *
 * The only time we auto-measure is when the table is completely fresh (every
 * cell has null colwidth), i.e. freshly pasted from markdown or an AI response.
 */
const tableHasStoredWidths = (node: ProseMirrorNode): boolean => {
    let found = false;
    node.forEach(rowNode => {
        if (found) return;
        rowNode.forEach(cell => {
            if (found) return;
            const { colwidth } = cell.attrs;
            if (colwidth && (colwidth as number[]).some((w: number) => w > 0)) {
                found = true;
            }
        });
    });
    return found;
};

/**
 * After the table's first paint, measure each <td>/<th> in every rendered row
 * and write those pixel widths back into the ProseMirror document as `colwidth`
 * attrs on any cell that doesn't already have stored widths.
 *
 * This makes pasted / imported tables behave exactly like manually-resized
 * ones: updateColumns finds real stored widths on every subsequent render and
 * never falls back to defaultCellWidth again.
 */
const persistNaturalWidths = (
    node: ProseMirrorNode,
    table: HTMLTableElement,
    view: EditorView,
    getPos: () => number | undefined,
    minCellWidth: number,
): void => {
    // Run after the browser has laid out the table so offsetWidth is real.
    requestAnimationFrame(() => {
        if (view.isDestroyed) return;
        if (!table.isConnected) return;

        const tablePos = getPos();
        if (typeof tablePos !== 'number') return;

        const liveTable = view.state.doc.nodeAt(tablePos);
        if (!liveTable) return;

        if (tableHasStoredWidths(liveTable)) return;

        const domRows = Array.from(table.querySelectorAll('tr')) as HTMLTableRowElement[];
        if (!domRows.length) return;

        const pmTr = view.state.tr;
        let changed = false;
        let rowIndex = 0;

        liveTable.forEach((rowNode, rowOffset) => {
            const domRow = domRows[rowIndex++];
            if (!domRow) return;

            const domCells = Array.from(domRow.querySelectorAll('td, th')) as HTMLElement[];
            let domCellIdx = 0;

            rowNode.forEach((pmCell, cellOffset) => {
                const { colspan, colwidth: existing } = pmCell.attrs;
                const needsMeasure = !existing || (existing as number[]).every((w: number) => !w);

                if (needsMeasure && domCells[domCellIdx]) {
                    const totalPx = domCells[domCellIdx].offsetWidth;
                    const perCol = Math.max(Math.round(totalPx / colspan), minCellWidth);
                    const newWidths = Array.from({ length: colspan }, () => perCol);

                    const absPos = tablePos + 1 + rowOffset + 1 + cellOffset;

                    pmTr.setNodeMarkup(absPos, undefined, {
                        ...pmCell.attrs,
                        colwidth: newWidths,
                    });
                    changed = true;
                }

                domCellIdx += colspan;
            });
        });

        if (changed) {
            pmTr.setMeta('addToHistory', false);
            view.dispatch(pmTr);
        }
    });
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

        // If this table has no stored colwidths (e.g. pasted from markdown or an
        // AI response), measure the browser's natural layout after first paint and
        // write the widths back into the document. This prevents every subsequent
        // updateColumns call from resetting columns to defaultCellWidth.
        if (!tableHasStoredWidths(node)) {
            persistNaturalWidths(node, this.table, this.view, this.getPos, this.minCellWidth);
        }

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

    updateColumns(
        node: ProseMirrorNode,
        colgroup: HTMLTableColElement,
        table: HTMLTableElement,
        cellMinWidth: number,
        overrideCol: number,
        overrideValue: number,
    ) {
        updateColumns(node, colgroup, table, cellMinWidth, this.defaultCellWidth, overrideCol, overrideValue);
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
                // defaultCellMinWidth is the floor the columnResizing plugin enforces
                // *during a drag*. It must equal cellMinWidth — NOT defaultCellWidth.
                // If it's set to defaultCellWidth (e.g. 120px), the plugin refuses to
                // let you drag any column below 120px and snaps back on mouseup.
                defaultCellMinWidth: minCellWidth,
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