import { useMemo, type RefObject } from 'react';
import { TextSelection } from '@tiptap/pm/state';
import { getEditorProps } from '@annota/editor-core';

interface UseDesktopEditorPropsArgs {
    direction: 'ltr' | 'rtl' | 'auto';
    editorSettings: any;
    editorRef: RefObject<any>;
    onOpenLinkMenuRef: RefObject<((event: any, url: string) => void) | undefined>;
    onOpenBlockMenuRef: RefObject<((event: any, resolve: () => any) => void) | undefined>;
    onOpenTableMenuRef: RefObject<((event: any, resolve: () => any) => void) | undefined>;
}

export function useDesktopEditorProps({
    direction,
    editorSettings,
    editorRef,
    onOpenLinkMenuRef,
    onOpenBlockMenuRef,
    onOpenTableMenuRef,
}: UseDesktopEditorPropsArgs) {
    return useMemo(() => {
        const baseProps = getEditorProps({
            direction: direction,
            spellcheck: editorSettings.spellcheck,
            autocorrect: editorSettings.autocorrect,
            autocapitalize: editorSettings.autocapitalize,
            autocomplete: editorSettings.autocomplete,
            onContextMenu: (view, event) => {
                const linkElement = event.composedPath().find((el: any) => el.nodeName === 'A') as HTMLAnchorElement | undefined;

                if (linkElement && linkElement.href && onOpenLinkMenuRef.current) {
                    const { state, dispatch } = view;

                    const coords = { left: event.clientX, top: event.clientY };
                    const posResult = view.posAtCoords(coords);
                    const pos = posResult ? posResult.pos : view.posAtDOM(event.target as Node, 0);

                    if (pos !== null) {
                        const { doc, schema } = state;
                        const markType = schema.marks.link;
                        if (markType) {
                            const $pos = doc.resolve(pos);
                            const range = $pos.markAround(markType);
                            if (range) {
                                dispatch(state.tr.setSelection(TextSelection.create(doc, range.from, range.to)));
                            } else {
                                dispatch(state.tr.setSelection(TextSelection.create(doc, pos)));
                            }
                        }
                    }

                    event.preventDefault();
                    const capturedHref = linkElement.href;
                    setTimeout(() => {
                        onOpenLinkMenuRef.current?.(event as any, capturedHref);
                    }, 50);
                    return true;
                }

                const headingElement = event.composedPath().find((el: any) => el?.tagName && /^H[1-6]$/.test(el.tagName)) as HTMLHeadingElement | undefined;

                if (headingElement && onOpenBlockMenuRef.current) {
                    event.preventDefault();
                    const { state } = view;
                    const coords = { left: event.clientX, top: event.clientY };
                    const posResult = view.posAtCoords(coords);
                    const pos = posResult ? posResult.pos : view.posAtDOM(headingElement, 0);

                    if (pos !== null) {
                        let targetPos = -1;
                        let headingNode = null;
                        const $pos = state.doc.resolve(pos);
                        for (let d = $pos.depth; d >= 0; d--) {
                            const node = $pos.node(d);
                            if (node && node.type.name === 'heading') {
                                headingNode = node;
                                targetPos = $pos.before(d);
                                break;
                            }
                        }
                        if (!headingNode) {
                            const node = state.doc.nodeAt(pos);
                            if (node && node.type.name === 'heading') {
                                headingNode = node;
                                targetPos = pos;
                            }
                        }

                        if (headingNode) {
                            const id = headingNode.attrs.id || headingElement.getAttribute('data-id');
                            if (id) {
                                setTimeout(() => {
                                    onOpenBlockMenuRef.current?.(event as any, () => ({
                                        pos: targetPos,
                                        message: {
                                            blockType: 'heading',
                                            id,
                                            level: headingNode.attrs.level || parseInt(headingElement.tagName.substring(1)),
                                        }
                                    }));
                                }, 50);
                                return true;
                            }
                        }
                    }
                }

                if (!onOpenTableMenuRef.current) return false;

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
                    onOpenTableMenuRef.current?.(event, () => ({
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
        });

        return {
            ...baseProps,
            handleScrollToSelection: () => {
                if (direction === 'rtl') {
                    return true;
                }
                return false;
            }
        };
    }, [direction, editorSettings, editorRef, onOpenLinkMenuRef, onOpenBlockMenuRef, onOpenTableMenuRef]);
}
