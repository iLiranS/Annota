import { Heading as TiptapHeading } from '@tiptap/extension-heading';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import './heading.css';

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

export const CustomHeading = TiptapHeading.extend({
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
        };
    },

    /**
     * NodeView where dom === contentDOM === the native <h1>/<h2>/etc element.
     * No wrapper div — serialized HTML is identical to native heading output.
     * Registering a NodeView makes posAtDOM resolve correctly for the drag handle.
     */
    addNodeView() {
        return ({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, any> }) => {
            const tag = `h${node.attrs.level}` as keyof HTMLElementTagNameMap;
            const heading = document.createElement(tag);
            heading.setAttribute('data-node-view-wrapper', '');

            Object.entries(HTMLAttributes).forEach(([k, v]) => {
                if (v != null) heading.setAttribute(k, String(v));
            });

            return {
                dom: heading,
                contentDOM: heading,
                update: (updatedNode: any) => {
                    if (updatedNode.type.name !== 'heading') return false;
                    // If level changed (h1→h2), return false to let Tiptap recreate the element
                    if (updatedNode.attrs.level !== node.attrs.level) return false;
                    if (updatedNode.attrs.id) {
                        heading.setAttribute('data-id', updatedNode.attrs.id);
                    } else {
                        heading.removeAttribute('data-id');
                    }
                    node = updatedNode;
                    return true;
                },
                ignoreMutation: (mutation: any) => {
                    if (mutation.type === 'attributes' && mutation.target === heading) {
                        return true;
                    }
                    return false;
                },
            };
        };
    },

    addProseMirrorPlugins() {
        return [
            ...this.parent?.() || [],
            new Plugin({
                key: new PluginKey('headingIdPlugin'),
                appendTransaction: (transactions, oldState, newState) => {
                    const docChanges = transactions.some(transaction => transaction.docChanged) && !oldState.doc.eq(newState.doc);
                    if (!docChanges) {
                        return;
                    }

                    const tr = newState.tr;
                    let modified = false;

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'heading' && !node.attrs.id) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateId() });
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
});