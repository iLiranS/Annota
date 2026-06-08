import { DOMSerializer, Slice } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { prepareMarksHTMLForClipboard } from '../extensions';
import { getPlainTextFromFragment } from './math';
import './shared'; // Ensure environment checks and drag state initialization are run

export const getEditorProps = (callbacks: {
    onScroll?: () => void;
    onContextMenu?: (view: any, event: MouseEvent) => boolean;
    direction?: string;
    spellcheck?: boolean;
    autocorrect?: boolean;
    autocapitalize?: boolean;
    autocomplete?: boolean;
}) => ({
    attributes: {
        dir: callbacks.direction || 'auto',
        spellcheck: callbacks.spellcheck !== undefined ? (callbacks.spellcheck ? 'true' : 'false') : 'true',
        autocorrect: callbacks.autocorrect ? 'on' : 'off',
        autocapitalize: callbacks.autocapitalize ? 'on' : 'off',
        autocomplete: callbacks.autocomplete ? 'on' : 'off',
    },
    scrollMargin: { top: 30, bottom: 85, left: 0, right: 0 },
    scrollThreshold: 10,
    handleScrollToSelection: () => {
        // While a block drag is in flight (or just finished), block PM's automatic
        // scrollIntoView so the viewport doesn't jump to the dropped node.
        if ((globalThis as any).__annotaDragBlock?.isDragging()) {
            return true;
        }
        if (callbacks.onScroll) {
            callbacks.onScroll();
            return true;
        }
        return false; // Allow default Prosemirror scroll with margin
    },
    handleDOMEvents: {
        copy: (view: any, event: ClipboardEvent) => {
            const { selection } = view.state;
            if (selection.empty || !event.clipboardData) return false;

            if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
                return false;
            }

            try {
                let slice = selection.content();

                // If it's a partial selection inside details or codeBlock, strip the wrappers
                if (slice.content.childCount === 1) {
                    const firstChild = slice.content.firstChild;
                    if (firstChild && (firstChild.type.name === 'codeBlock' || firstChild.type.name === 'details')) {
                        if (slice.openStart > 0 || slice.openEnd > 0) {
                            if (firstChild.type.name === 'codeBlock') {
                                slice = new Slice(firstChild.content, Math.max(0, slice.openStart - 1), Math.max(0, slice.openEnd - 1));
                            } else if (firstChild.type.name === 'details') {
                                const newNodes: any[] = [];
                                firstChild.content.forEach((node: any) => {
                                    if (node.type.name === 'detailsContent' || node.type.name === 'detailsSummary') {
                                        node.content.forEach((innerNode: any) => {
                                            newNodes.push(innerNode);
                                        });
                                    } else {
                                        newNodes.push(node);
                                    }
                                });
                                // @ts-ignore
                                const newFragment = slice.content.constructor.from(newNodes);
                                slice = new Slice(newFragment, Math.max(0, slice.openStart - 2), Math.max(0, slice.openEnd - 2));
                            }
                        }
                    }
                }

                const serializer = DOMSerializer.fromSchema(view.state.schema);
                const div = document.createElement('div');
                div.appendChild(serializer.serializeFragment(slice.content));

                let hasSetData = false;
                try {
                    event.clipboardData.setData('text/plain', getPlainTextFromFragment(slice.content));
                    hasSetData = true;
                } catch (e) {
                    console.error('Failed to set text/plain in clipboard:', e);
                }
                try {
                    event.clipboardData.setData('text/html', prepareMarksHTMLForClipboard(div.innerHTML));
                    hasSetData = true;
                } catch (e) {
                    console.error('Failed to set text/html in clipboard:', e);
                }
                try {
                    event.clipboardData.setData('application/x-prosemirror-flat-slice', JSON.stringify(slice.toJSON()));
                    hasSetData = true;
                } catch (e) {
                    // Custom MIME types may fail in some environments (like WebKit/Safari/Tauri)
                }

                if (hasSetData) {
                    event.preventDefault();
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        },
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
            // .replace(/color\s*:[^;"']*(;|(?=["']))/gi, '')
            // .replace(/background-color\s*:[^;"']*(;|(?=["']))/gi, '')
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
                        const newNodes: any[] = [];
                        firstChild.content.forEach((node: any) => {
                            if (node.type.name === 'detailsContent' || node.type.name === 'detailsSummary') {
                                node.content.forEach((innerNode: any) => {
                                    newNodes.push(innerNode);
                                });
                            } else {
                                newNodes.push(node);
                            }
                        });
                        // @ts-ignore
                        const newFragment = slice.content.constructor.from(newNodes);
                        return new Slice(newFragment, Math.max(0, slice.openStart - 2), Math.max(0, slice.openEnd - 2));
                    }
                }
            }
        }
        return slice;
    },
});
