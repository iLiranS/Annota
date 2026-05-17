import { Paragraph } from '@tiptap/extension-paragraph';

export const CustomParagraph = Paragraph.extend({
    addNodeView() {
        return ({ HTMLAttributes, getPos, editor }) => {
            const p = document.createElement('p');
            Object.entries(HTMLAttributes).forEach(([k, v]) => {
                if (v != null) p.setAttribute(k, String(v));
            });

            const syncAttribute = () => {
                if (typeof getPos !== 'function') return;
                const pos = getPos();
                if (typeof pos !== 'number') return;
                // A paragraph is top-level when its depth in the doc is 1
                // (depth 0 = doc itself, depth 1 = direct block child).
                const $pos = editor.state.doc.resolve(pos);
                const isTopLevel = $pos.depth === 0;
                if (isTopLevel) {
                    p.setAttribute('data-node-view-wrapper', '');
                } else {
                    p.removeAttribute('data-node-view-wrapper');
                }
            };

            syncAttribute();

            return {
                dom: p,
                contentDOM: p,
                update: (updatedNode: any) => {
                    if (updatedNode.type.name !== 'paragraph') return false;
                    syncAttribute();
                    return true;
                },
                ignoreMutation: (mutation: any) => {
                    if (mutation.type === 'attributes' && mutation.target === p) {
                        return true;
                    }
                    return false;
                },
            };
        };
    },
});