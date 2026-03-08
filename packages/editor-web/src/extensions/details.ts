import { mergeAttributes } from '@tiptap/core';
import { Details as TiptapDetails, DetailsContent as TiptapDetailsContent, DetailsSummary as TiptapDetailsSummary } from '@tiptap/extension-details';
import { Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { createBlockMenuButton } from './block-menu-button';
import { generateBlockId } from './id-generator';

/** Strip the `dir` attribute so details nodes inherit direction from the editor root */
function stripDir(attrs: Record<string, any>): Record<string, any> {
    const { dir, ...rest } = attrs;
    return rest;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        setDetails: () => ReturnType;
        unsetDetails: () => ReturnType;
        toggleDetails: () => ReturnType;
        setDetailsBackground: (color: string) => ReturnType;
        unsetDetailsBackground: () => ReturnType;
    }
}

// Extend Details with custom rendering and parsing
export const Details = TiptapDetails.extend({
    // Disable the built-in NodeView that renders the toggle button
    addNodeView() {
        return null as any;
    },

    // Parse both our custom format and native details
    parseHTML() {
        return [
            { tag: 'div[data-type="details"]' },
            { tag: 'div.details-wrapper' },
            { tag: 'details' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(stripDir(HTMLAttributes), { 'data-type': 'details', class: 'details-wrapper' }), 0];
    },

    addAttributes() {
        return {
            ...this.parent?.(),
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => {
                    if (!attributes.id) {
                        return {};
                    }
                    return { 'data-id': attributes.id };
                },
            },
            open: {
                default: true,
                parseHTML: element => {
                    // Check multiple sources for open state
                    if (element.hasAttribute('open')) return true;
                    if (element.getAttribute('data-open') === 'true') return true;
                    if (element.getAttribute('data-open') === 'false') return false;
                    return true; // Default to open
                },
                renderHTML: attributes => {
                    return {
                        'data-open': attributes.open ? 'true' : 'false',
                        ...(attributes.open ? { open: '' } : {}),
                    };
                },
            },
            backgroundColor: {
                default: null,
                parseHTML: element => element.getAttribute('data-background-color'),
                renderHTML: attributes => {
                    if (!attributes.backgroundColor) {
                        return {};
                    }
                    return {
                        'data-background-color': attributes.backgroundColor,
                        style: `background-color: ${attributes.backgroundColor}`,
                    };
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('preventNestedDetails'),
                props: {
                    transformPasted: (slice) => {
                        // Recursively unwrap details nodes if they are inside another details node
                        // However, transformPasted runs *before* insertion, so we don't know the context yet in slice.
                        // But actually, we want to prevent details inside details. 
                        // If we are pasting *into* a details node, we should flatten the slice if it contains details.

                        // Strategy: We can't easily check insertion context here. 
                        // But we can check if the slice contains details, and if the *selection* is inside details.
                        // Wait, transformPasted receives the slice. We need access to the view/state to check selection.
                        // transformPasted doesn't give access to state directly.

                        // Alternative: handlePaste
                        return slice;
                    },
                    handlePaste: (view, _event, slice) => {
                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;

                        // Check if we are pasting inside a details node
                        let insideDetails = false;
                        for (let d = $from.depth; d > 0; d--) {
                            if ($from.node(d).type.name === 'details') {
                                insideDetails = true;
                                break;
                            }
                        }

                        if (!insideDetails) return false; // Default handling

                        // We are inside details. Check if slice has details nodes.
                        let hasDetails = false;
                        slice.content.descendants((node) => {
                            if (node.type.name === 'details') {
                                hasDetails = true;
                            }
                        });

                        if (!hasDetails) return false; // Default handling

                        // Flatten the slice: Replace details nodes with their content (block | detailsContent -> content)
                        // A details node has (summary, content). We probably just want the content of the detailsContent.
                        const newNodes: any[] = [];

                        slice.content.forEach((node) => {
                            if (node.type.name === 'details') {
                                // Extract content from details -> detailsContent -> children
                                node.content.forEach((child) => {
                                    if (child.type.name === 'detailsContent') {
                                        child.content.forEach((innerNode) => {
                                            newNodes.push(innerNode);
                                        });
                                    }
                                });
                            } else {
                                newNodes.push(node);
                            }
                        });

                        // Create a new Fragment from the nodes
                        // @ts-ignore
                        const newFragment = slice.content.constructor.from(newNodes);

                        // Create a new Slice
                        const newSlice = new Slice(newFragment, slice.openStart, slice.openEnd);

                        const transaction = view.state.tr.replaceSelection(newSlice);
                        view.dispatch(transaction);
                        return true; // Handled
                    }
                }
            }),
            new Plugin({
                key: new PluginKey('detailsIdPlugin'),
                appendTransaction: (transactions, oldState, newState) => {
                    const docChanges = transactions.some(transaction => transaction.docChanged) && !oldState.doc.eq(newState.doc);
                    if (!docChanges) {
                        return;
                    }

                    const tr = newState.tr;
                    let modified = false;

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'details' && !node.attrs.id) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateBlockId() });
                            modified = true;
                        }
                    });

                    if (modified) {
                        return tr;
                    }
                },
            }),
        ];
    },

    addCommands() {
        return {
            ...this.parent?.(),
            setDetails:
                () =>
                    ({ commands, state }: { commands: any; state: any }) => {
                        const { selection } = state;
                        const { $from } = selection;

                        // Check if we are already inside a details node
                        for (let d = $from.depth; d > 0; d--) {
                            if ($from.node(d).type.name === 'details') {
                                return false;
                            }
                        }

                        let contentToWrap: any[] = [];
                        if (!selection.empty) {
                            const fragment = state.doc.slice(selection.from, selection.to).content;
                            contentToWrap = fragment.toJSON() || [];
                        }

                        // If empty selection or failed to extract, add a default paragraph
                        if (contentToWrap.length === 0) {
                            contentToWrap = [{ type: 'paragraph' }];
                        }

                        return commands.insertContent({
                            type: this.name,
                            content: [
                                { type: 'detailsSummary', content: [{ type: 'text', text: 'Summary' }] },
                                { type: 'detailsContent', content: contentToWrap },
                            ],
                        });
                    },
            toggleDetails:
                () =>
                    ({ commands, state }: { commands: any; state: any }) => {
                        if (this.editor.isActive('details')) {
                            return commands.unsetDetails();
                        }
                        return commands.setDetails();
                    },
            setDetailsBackground:
                (color: string) =>
                    ({ commands }: { commands: any }) => {
                        return commands.updateAttributes('details', { backgroundColor: color });
                    },
            unsetDetailsBackground:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.updateAttributes('details', { backgroundColor: null });
                    },
        };
    },
});

export const DetailsSummary = TiptapDetailsSummary.extend<any>({
    addOptions() {
        return {
            ...this.parent?.(),
            onOpenBlockMenu: null,
        };
    },
    addNodeView() {
        return ({ HTMLAttributes, getPos, editor }: { node: any, HTMLAttributes: Record<string, any>, getPos: any, editor: any }) => {
            const dom = document.createElement('div');
            Object.entries(stripDir(HTMLAttributes)).forEach(([key, value]) => {
                dom.setAttribute(key as string, value as string);
            });
            dom.setAttribute('data-type', 'detailsSummary');
            dom.className = 'details-summary';

            const content = document.createElement('div');
            content.className = 'details-summary-content';
            content.style.flex = '1';

            // Menu button — shared three-dot utility
            const menuBtn = createBlockMenuButton({
                className: 'details-menu-btn',
                onClick: this.options.onOpenBlockMenu,
                onResolve: () => {
                    if (typeof getPos !== 'function') return null;
                    const pos = getPos();
                    let targetPos = pos;
                    const $pos = editor.state.doc.resolve(pos);
                    const parentDetails = $pos.parent;

                    // Resolve up to the parent 'details' node
                    if (parentDetails.type.name === 'details') {
                        targetPos = $pos.before($pos.depth);
                    }

                    return {
                        pos: targetPos,
                        message: {
                            type: 'openBlockMenu',
                            blockType: 'details',
                            currentColor: parentDetails?.attrs.backgroundColor,
                            id: parentDetails?.attrs.id || HTMLAttributes.id,
                            pos: targetPos,
                        },
                    };
                },
            });

            // ID is now generated via ProseMirror plugin!

            // Toggle open state on click
            dom.onclick = (e) => {
                // If clicking the menu button, don't toggle
                if (menuBtn.contains(e.target as Node)) return;

                e.preventDefault();
                e.stopPropagation();

                if (typeof getPos !== 'function') return;
                const pos = getPos();
                if (typeof pos !== 'number') return;

                const { state, view } = editor;

                // Find parent details node
                const $pos = state.doc.resolve(pos);
                const parentNode = $pos.parent;
                const parentPos = $pos.before($pos.depth);

                if (parentNode.type.name === 'details') {
                    const isOpen = parentNode.attrs.open;
                    view.dispatch(
                        state.tr.setNodeMarkup(parentPos, undefined, {
                            ...parentNode.attrs,
                            open: !isOpen
                        })
                    );
                }
            };

            dom.appendChild(content);
            dom.appendChild(menuBtn);

            return {
                dom,
                contentDOM: content,
                ignoreMutation: (mutation) => {
                    return mutation.target === menuBtn || menuBtn.contains(mutation.target as Node);
                },
            };
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-type="detailsSummary"]' },
            { tag: 'div.details-summary' },
            { tag: 'summary' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(stripDir(HTMLAttributes), { 'data-type': 'detailsSummary', class: 'details-summary' }), 0];
    },
});

export const DetailsContent = TiptapDetailsContent.extend({
    addNodeView() {
        return null as any;
    },

    parseHTML() {
        return [
            { tag: 'div[data-type="detailsContent"]' },
            { tag: 'div.details-content' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(stripDir(HTMLAttributes), { 'data-type': 'detailsContent', class: 'details-content' }), 0];
    },
});
