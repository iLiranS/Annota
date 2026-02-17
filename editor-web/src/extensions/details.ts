import { mergeAttributes } from '@tiptap/core';
import { Details as TiptapDetails, DetailsContent as TiptapDetailsContent, DetailsSummary as TiptapDetailsSummary } from '@tiptap/extension-details';
import { Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { sendMessage } from '../bridge';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        customDetails: {
            setDetailsBackground: (color: string) => ReturnType;
            unsetDetailsBackground: () => ReturnType;
        };

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
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'details', class: 'details-wrapper' }), 0];
    },

    addAttributes() {
        return {
            ...this.parent?.(),
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
            })
        ];
    },

    addCommands() {
        return {
            ...this.parent?.(),
            setDetailsBackground:
                (color: string) =>
                    ({ commands }: any) => {
                        return commands.updateAttributes('details', { backgroundColor: color });
                    },
            unsetDetailsBackground:
                () =>
                    ({ commands }: any) => {
                        return commands.updateAttributes('details', { backgroundColor: null });
                    },
        };
    },
});

export const DetailsSummary = TiptapDetailsSummary.extend({
    addNodeView() {
        return ({ HTMLAttributes, getPos, editor }: { node: any, HTMLAttributes: Record<string, any>, getPos: any, editor: any }) => {
            const dom = document.createElement('div');
            Object.entries(HTMLAttributes).forEach(([key, value]) => {
                dom.setAttribute(key as string, value as string);
            });
            dom.setAttribute('data-type', 'detailsSummary');
            dom.className = 'details-summary';

            const content = document.createElement('div');
            content.className = 'details-summary-content';
            content.style.flex = '1';

            // Menu button
            const menuBtn = document.createElement('button');
            menuBtn.className = 'details-menu-btn';
            menuBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
            menuBtn.contentEditable = 'false';

            menuBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (typeof getPos === 'function') {
                    const pos = getPos();
                    let targetPos = pos;
                    const $pos = editor.state.doc.resolve(pos);
                    const parentDetails = $pos.parent;

                    // Check if the parent is indeed a 'details' node to be safe
                    if (parentDetails.type.name === 'details') {
                        // Use parent position
                        targetPos = $pos.before($pos.depth);
                    }
                    // Else targetPos remains pos (summary)

                    sendMessage({
                        type: 'openBlockMenu',
                        blockType: 'details',
                        currentColor: parentDetails?.attrs.backgroundColor,
                        pos: targetPos
                    });
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
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'detailsSummary', class: 'details-summary' }), 0];
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
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'detailsContent', class: 'details-content' }), 0];
    },
});
