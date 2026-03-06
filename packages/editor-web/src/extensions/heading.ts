import { Heading as TiptapHeading } from '@tiptap/extension-heading';
import { Plugin, PluginKey } from '@tiptap/pm/state';

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
