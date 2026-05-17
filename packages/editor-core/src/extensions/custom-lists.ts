import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { TaskList } from '@tiptap/extension-task-list';

/**
 * NodeView where dom === contentDOM === the native <ul>/<ol>.
 * No wrapper div — serialized HTML stays clean.
 * Registering a NodeView makes posAtDOM resolve correctly so the
 * drag handle (nested:false) reliably anchors to the list container.
 */
function makeListNodeView(tagName: 'ul' | 'ol') {
    return ({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, any> }) => {
        const list = document.createElement(tagName);
        list.setAttribute('data-node-view-wrapper', '');
        
        if (node.type.name === 'taskList') {
            list.setAttribute('data-type', 'taskList');
        }

        Object.entries(HTMLAttributes).forEach(([k, v]) => {
            if (v != null) list.setAttribute(k, String(v));
        });

        return {
            dom: list,
            contentDOM: list,
            update: (newNode: any) => {
                if (newNode.type.name !== node.type.name) return false;
                
                if (newNode.type.name === 'taskList') {
                    list.setAttribute('data-type', 'taskList');
                }

                Object.entries(newNode.attrs).forEach(([k, v]) => {
                    if (v != null) list.setAttribute(k, String(v));
                    else list.removeAttribute(k);
                });
                node = newNode;
                return true;
            },
            ignoreMutation: (mutation: any) => {
                if (mutation.type === 'attributes' && mutation.target === list) {
                    return true;
                }
                return false;
            },
        };
    };
}

export const CustomBulletList = BulletList.extend({
    addNodeView() {
        return makeListNodeView('ul');
    },
});

export const CustomOrderedList = OrderedList.extend({
    addNodeView() {
        return makeListNodeView('ol');
    },
});

export const CustomTaskList = TaskList.extend({
    addNodeView() {
        return makeListNodeView('ul');
    },
});