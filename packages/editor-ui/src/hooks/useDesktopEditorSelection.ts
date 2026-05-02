import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

const RICH_NODE_TYPES = new Set([
    'blockquote',
    'codeBlock',
    'details',
    'flashcardBlock',
    'image',
    'mermaid',
    'table',
    'blockMath',
]);

const RICH_SELECTION_SELECTOR = [
    '.code-block-wrapper',
    '.tableWrapper',
    '.mermaid-block',
    '.flashcard-block',
    '[data-type="details"]',
    '[data-type="blockMath"]',
    '[data-type="block-math"]',
    '.tiptap-mathematics-render[data-type="block-math"]',
    '.image-node-wrapper',
    '.quote-wrapper',
    'blockquote',
].join(',');

const SELECTION_DRAG_SKIP_SELECTOR = [
    'input',
    'textarea',
    'select',
    'option',
    'a',
].join(',');

const RICH_CHROME_SELECTOR = [
    'button',
    '.code-block-header',
    '.mermaid-zoom-toolbar',
    '.mermaid-menu-btn',
    '.details-menu-btn',
    '.flashcard-nav-overlay-btn',
    '.quote-menu-btn',
].join(',');

const RICH_TEXT_SURFACE_SELECTOR = [
    'code',
    'td',
    'th',
    'p',
    'blockquote',
    '[data-type="detailsSummary"]',
    '[data-type="detailsContent"]',
].join(',');

type SelectionDragState = {
    active: boolean;
    anchorPrefersRichBoundary: boolean;
    anchorRichHit: { nodeSize: number; pos: number } | null;
    dragging: boolean;
    anchorPos: number;
    startX: number;
    startY: number;
};

type RichHit = {
    element: HTMLElement;
    node: ProseMirrorNode;
    pos: number;
};

type UseDesktopEditorSelectionArgs = {
    editor: Editor | null;
    containerRef: RefObject<HTMLDivElement | null>;
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function isRichNode(node: ProseMirrorNode) {
    return RICH_NODE_TYPES.has(node.type.name);
}

function richAncestorKey($pos: ResolvedPos) {
    for (let depth = $pos.depth; depth > 0; depth--) {
        const node = $pos.node(depth);
        if (isRichNode(node)) {
            return `${node.type.name}:${$pos.before(depth)}`;
        }
    }
    return null;
}

function resolveRichElement(editor: Editor, node: ProseMirrorNode, pos: number) {
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return null;

    switch (node.type.name) {
        case 'table':
            return dom.closest('.tableWrapper') as HTMLElement | null;
        case 'codeBlock':
            return dom.closest('.code-block-wrapper') as HTMLElement | null;
        case 'blockquote':
            return (dom.closest('.quote-wrapper') || dom.closest('blockquote')) as HTMLElement | null;
        case 'details':
            return dom.closest('[data-type="details"]') as HTMLElement | null;
        case 'flashcardBlock':
            return dom.closest('.flashcard-block') as HTMLElement | null;
        case 'image':
            return dom.closest('.image-node-wrapper') as HTMLElement | null;
        case 'mermaid':
            return dom.closest('.mermaid-block') as HTMLElement | null;
        case 'blockMath':
            return dom.closest('[data-type="blockMath"], [data-type="block-math"], .tiptap-mathematics-render[data-type="block-math"]') as HTMLElement | null;
        default:
            return dom.closest(RICH_SELECTION_SELECTOR) as HTMLElement | null;
    }
}

function findRichHitForElement(editor: Editor, element: Element | null): RichHit | null {
    if (!element) return null;

    const richElement = element.closest(RICH_SELECTION_SELECTOR);
    if (!(richElement instanceof HTMLElement)) return null;

    let found: RichHit | null = null;
    editor.state.doc.descendants((node, pos) => {
        if (!isRichNode(node)) return true;

        const candidate = resolveRichElement(editor, node, pos);
        if (!candidate) return false;

        if (candidate === richElement || candidate.contains(richElement) || richElement.contains(candidate)) {
            found = { element: candidate, node, pos };
            return false;
        }

        return true;
    });

    return found;
}

function findRichHitAtPoint(editor: Editor, event: MouseEvent): RichHit | null {
    const target = event.target instanceof Element ? event.target : null;
    const targetHit = findRichHitForElement(editor, target);
    if (targetHit) return targetHit;

    const pointed = document.elementFromPoint(event.clientX, event.clientY);
    return findRichHitForElement(editor, pointed);
}

function richBoundaryForPoint(hit: RichHit, clientY: number) {
    const rect = hit.element.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? hit.pos : hit.pos + hit.node.nodeSize;
}

function prefersRichBoundary(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : document.elementFromPoint(event.clientX, event.clientY);
    if (!target) return false;
    if (target.closest(RICH_CHROME_SELECTOR)) return true;
    if (!target.closest(RICH_SELECTION_SELECTOR)) return false;
    return !target.closest(RICH_TEXT_SURFACE_SELECTOR);
}

function findRichElementsInEditorSelection(editor: Editor) {
    const { state } = editor;
    const { selection } = state;

    if (selection.empty) return [];

    const sameRichAncestor = richAncestorKey(selection.$anchor) === richAncestorKey(selection.$head)
        ? richAncestorKey(selection.$anchor)
        : null;

    if (sameRichAncestor) {
        return [];
    }

    const from = Math.min(selection.from, selection.to);
    const to = Math.max(selection.from, selection.to);
    const elements: HTMLElement[] = [];

    state.doc.nodesBetween(from, to, (node, pos) => {
        if (!isRichNode(node)) return true;

        const nodeEnd = pos + node.nodeSize;
        if (from >= nodeEnd || to <= pos) return false;

        const element = resolveRichElement(editor, node, pos);
        if (!element) return false;

        if (!elements.some(parent => parent.contains(element))) {
            elements.push(element);
        }

        return false;
    });

    return elements;
}

function findRichElementsInDomSelection(root: HTMLElement, pm: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
        return [];
    }

    if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
        return [];
    }

    const range = selection.getRangeAt(0);
    const elements: HTMLElement[] = [];

    pm.querySelectorAll(RICH_SELECTION_SELECTOR).forEach(element => {
        if (!(element instanceof HTMLElement)) return;

        try {
            if (!range.intersectsNode(element)) return;
        } catch {
            return;
        }

        if (element.contains(selection.anchorNode) && element.contains(selection.focusNode)) {
            return;
        }

        if (!elements.some(parent => parent.contains(element))) {
            elements.push(element);
        }
    });

    return elements;
}

export function useDesktopEditorSelection({ editor, containerRef }: UseDesktopEditorSelectionArgs) {
    const selectedRichBlocksRef = useRef<HTMLElement[]>([]);
    const selectionDragRef = useRef<SelectionDragState | null>(null);

    const clearRichSelectionClasses = useCallback(() => {
        selectedRichBlocksRef.current.forEach(el => {
            el.classList.remove('annota-selection-covered');
        });
        selectedRichBlocksRef.current = [];
        containerRef.current?.classList.remove('annota-pretty-selection');
    }, [containerRef]);

    useEffect(() => {
        const root = containerRef.current;
        const pm = editor?.view?.dom as HTMLElement | undefined;
        if (!root || !editor || !pm) return;

        let frame = 0;

        const applyElements = (nextSelected: HTMLElement[]) => {
            selectedRichBlocksRef.current.forEach(el => {
                if (!nextSelected.includes(el)) {
                    el.classList.remove('annota-selection-covered');
                }
            });

            nextSelected.forEach(el => {
                el.classList.add('annota-selection-covered');
            });

            selectedRichBlocksRef.current = nextSelected;
            root.classList.toggle('annota-pretty-selection', nextSelected.length > 0);
        };

        const updateRichSelectionClasses = () => {
            frame = 0;
            if (editor.isDestroyed) {
                clearRichSelectionClasses();
                return;
            }

            const editorElements = findRichElementsInEditorSelection(editor);
            applyElements(editorElements.length > 0 ? editorElements : findRichElementsInDomSelection(root, pm));
        };

        const scheduleUpdate = () => {
            if (frame) return;
            frame = requestAnimationFrame(updateRichSelectionClasses);
        };

        editor.on('selectionUpdate', scheduleUpdate);
        editor.on('transaction', scheduleUpdate);
        document.addEventListener('selectionchange', scheduleUpdate);
        window.addEventListener('mouseup', scheduleUpdate, true);

        scheduleUpdate();

        return () => {
            if (frame) cancelAnimationFrame(frame);
            editor.off('selectionUpdate', scheduleUpdate);
            editor.off('transaction', scheduleUpdate);
            document.removeEventListener('selectionchange', scheduleUpdate);
            window.removeEventListener('mouseup', scheduleUpdate, true);
            clearRichSelectionClasses();
        };
    }, [editor, containerRef, clearRichSelectionClasses]);

    useEffect(() => {
        const root = containerRef.current;
        const view = editor?.view;
        const pm = view?.dom as HTMLElement | undefined;
        if (!root || !editor || !view || !pm) return;

        let frame = 0;
        let lastMoveEvent: MouseEvent | null = null;

        const posAtMouse = (event: MouseEvent, preferRichBoundary = false) => {
            const rect = pm.getBoundingClientRect();
            const left = clamp(event.clientX, rect.left + 1, rect.right - 1);

            const richHit = findRichHitAtPoint(editor, event);
            if (preferRichBoundary && richHit) {
                return richBoundaryForPoint(richHit, event.clientY);
            }

            const result = view.posAtCoords({ left, top: event.clientY });

            if (result) return result.pos;
            if (richHit) return richBoundaryForPoint(richHit, event.clientY);
            if (event.clientY < rect.top) return 0;
            if (event.clientY > rect.bottom) return view.state.doc.content.size;
            return null;
        };

        const tablePosAt = (pos: number) => {
            const $pos = view.state.doc.resolve(clamp(pos, 0, view.state.doc.content.size));
            for (let depth = $pos.depth; depth > 0; depth--) {
                if ($pos.node(depth).type.name === 'table') {
                    return $pos.before(depth);
                }
            }
            return null;
        };

        const applyDragSelection = (event: MouseEvent) => {
            frame = 0;

            const drag = selectionDragRef.current;
            if (!drag?.active || !drag.dragging || editor.isDestroyed) return;

            const headPrefersRichBoundary = prefersRichBoundary(event);
            const headPos = posAtMouse(event, drag.anchorPrefersRichBoundary || headPrefersRichBoundary);
            if (headPos === null || headPos === drag.anchorPos) return;

            const currentRichHit = findRichHitAtPoint(editor, event);

            const anchorTable = tablePosAt(drag.anchorPos);
            const headTable = tablePosAt(headPos);
            if (!drag.anchorPrefersRichBoundary && !headPrefersRichBoundary && anchorTable !== null && anchorTable === headTable) {
                return;
            }

            const { state } = view;
            const anchor = clamp(drag.anchorPos, 0, state.doc.content.size);
            const head = clamp(headPos, 0, state.doc.content.size);
            const selection = drag.anchorPrefersRichBoundary &&
                drag.anchorRichHit &&
                currentRichHit?.pos === drag.anchorRichHit.pos
                ? NodeSelection.create(state.doc, drag.anchorRichHit.pos)
                : TextSelection.between(
                    state.doc.resolve(anchor),
                    state.doc.resolve(head),
                    head >= anchor ? 1 : -1,
                );

            if (!selection.eq(state.selection)) {
                view.dispatch(state.tr.setSelection(selection));
                // Only clear the DOM selection when a rich-block boundary was used.
                // For plain inline text, the native highlight should remain intact so
                // the user can see what is selected.
                if (drag.anchorPrefersRichBoundary || headPrefersRichBoundary) {
                    window.getSelection()?.removeAllRanges();
                }
            }
        };

        const scheduleDragSelection = (event: MouseEvent) => {
            lastMoveEvent = event;
            if (frame) return;
            frame = requestAnimationFrame(() => {
                if (lastMoveEvent) applyDragSelection(lastMoveEvent);
            });
        };

        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            if (!pm.contains(event.target as Node)) return;

            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest(SELECTION_DRAG_SKIP_SELECTOR)) return;

            const anchorPrefersRichBoundary = prefersRichBoundary(event);
            const anchorRichHit = findRichHitAtPoint(editor, event);
            const anchorPos = posAtMouse(event, anchorPrefersRichBoundary);
            if (anchorPos === null) return;

            selectionDragRef.current = {
                active: true,
                anchorPrefersRichBoundary,
                anchorRichHit: anchorRichHit ? { nodeSize: anchorRichHit.node.nodeSize, pos: anchorRichHit.pos } : null,
                dragging: false,
                anchorPos,
                startX: event.clientX,
                startY: event.clientY,
            };
        };

        const handleMouseMove = (event: MouseEvent) => {
            const drag = selectionDragRef.current;
            if (!drag?.active || (event.buttons & 1) !== 1) return;

            if (!drag.dragging) {
                const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
                if (moved < 4) return;
                drag.dragging = true;
            }

            if (drag.anchorPrefersRichBoundary || prefersRichBoundary(event)) {
                event.preventDefault();
            }
            scheduleDragSelection(event);
        };

        const finishDrag = (event?: MouseEvent) => {
            const drag = selectionDragRef.current;
            if (drag?.active && drag.dragging && event) {
                applyDragSelection(event);
            }
            selectionDragRef.current = null;
        };
        const cancelDrag = () => {
            selectionDragRef.current = null;
        };

        root.addEventListener('mousedown', handleMouseDown, true);
        window.addEventListener('mousemove', handleMouseMove, true);
        window.addEventListener('mouseup', finishDrag, true);
        window.addEventListener('blur', cancelDrag, true);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            root.removeEventListener('mousedown', handleMouseDown, true);
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('mouseup', finishDrag, true);
            window.removeEventListener('blur', cancelDrag, true);
            selectionDragRef.current = null;
        };
    }, [editor, containerRef]);
}
