import { mergeAttributes, getRenderedAttributes } from '@tiptap/core';
import { TaskItem } from '@tiptap/extension-task-item';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * CustomTaskItem — extends Tiptap's TaskItem to decouple the editor DOM from
 * the serialized HTML.
 *
 * Editor DOM (NodeView): full interactive structure with <label>, <input>,
 * <span>, <div> — preserving all existing CSS selectors in task-list.css.
 *
 * Serialized HTML (renderHTML / getHTML): clean minimal
 *   <li data-checked="false"><p>text</p></li>
 * No UI boilerplate — saves ~120 bytes per task item in storage.
 *
 * parseHTML accepts:
 *   1. Clean format:  <li data-checked="...">
 *   2. Tiptap format: <li data-type="taskItem">
 *   3. External apps: <li> containing <input type="checkbox">
 */
export const CustomTaskItem = TaskItem.extend({
    parseHTML() {
        return [
            // 1. Our clean format (new)
            {
                tag: 'li[data-checked]',
                priority: 52,
                getAttrs: (element) => {
                    if (!(element instanceof HTMLElement)) return false;
                    // Only match if inside a taskList container, or has data-checked
                    // (avoid matching random <li data-checked> outside task lists)
                    return {};
                },
            },
            // 2. Tiptap's default format (backwards compat with stored notes)
            {
                tag: `li[data-type="taskItem"]`,
                priority: 51,
            },
            // 3. External apps (Notion, Google Docs, GitHub, etc.)
            //    They paste <li> with a checkbox <input> inside
            {
                tag: 'li',
                priority: 10,
                getAttrs: (element) => {
                    if (!(element instanceof HTMLElement)) return false;
                    const checkbox = element.querySelector('input[type="checkbox"]');
                    if (!checkbox) return false;
                    return {
                        checked: (checkbox as HTMLInputElement).checked ||
                            checkbox.hasAttribute('checked'),
                    };
                },
            },
        ];
    },

    addAttributes() {
        return {
            checked: {
                default: false,
                keepOnSplit: false,
                parseHTML: (element) => {
                    const dataChecked = element.getAttribute('data-checked');
                    if (dataChecked !== null) {
                        return dataChecked === '' || dataChecked === 'true';
                    }
                    // Fallback: check for a checkbox input inside (external paste)
                    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
                    if (checkbox) {
                        return checkbox.checked || checkbox.hasAttribute('checked');
                    }
                    return false;
                },
                renderHTML: (attributes) => ({
                    'data-checked': attributes.checked,
                }),
            },
        };
    },

    renderHTML({ HTMLAttributes }) {
        // Clean minimal output — no label/input/div wrappers.
        // Children (paragraph, nested lists) render directly inside the <li>.
        return [
            'li',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
            0,
        ];
    },

    addNodeView() {
        return ({ node, HTMLAttributes, getPos, editor }) => {
            const listItem = document.createElement('li');
            const checkboxWrapper = document.createElement('label');
            const checkboxStyler = document.createElement('span');
            const checkbox = document.createElement('input');
            const content = document.createElement('div');

            checkboxWrapper.contentEditable = 'false';
            checkbox.type = 'checkbox';
            checkbox.ariaLabel = `Task item checkbox for ${node.textContent || 'empty task item'}`;

            // Prevent focus loss on mousedown
            checkbox.addEventListener('mousedown', (event) => event.preventDefault());

            // Toggle checked state on change
            checkbox.addEventListener('change', (event) => {
                if (!editor.isEditable) {
                    checkbox.checked = !checkbox.checked;
                    return;
                }

                const { checked } = event.target as HTMLInputElement;

                if (typeof getPos === 'function') {
                    editor
                        .chain()
                        .focus(undefined, { scrollIntoView: false })
                        .command(({ tr }) => {
                            const position = getPos();
                            if (typeof position !== 'number') return false;

                            const currentNode = tr.doc.nodeAt(position);
                            tr.setNodeMarkup(position, undefined, {
                                ...currentNode?.attrs,
                                checked,
                            });
                            return true;
                        })
                        .run();
                }
            });

            // Apply static HTML attributes from options
            Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
                listItem.setAttribute(key, value);
            });

            // Set initial state
            listItem.dataset.checked = node.attrs.checked;
            checkbox.checked = node.attrs.checked;

            // Assemble DOM: li > label(input + span) + div(contentDOM)
            checkboxWrapper.append(checkbox, checkboxStyler);
            listItem.append(checkboxWrapper, content);

            // Apply dynamic HTML attributes
            Object.entries(HTMLAttributes).forEach(([key, value]) => {
                listItem.setAttribute(key, value);
            });

            // Track previously rendered attribute keys for cleanup on update
            let prevRenderedAttributeKeys = new Set(Object.keys(HTMLAttributes));

            return {
                dom: listItem,
                contentDOM: content,
                update: (updatedNode: ProseMirrorNode) => {
                    if (updatedNode.type !== this.type) return false;

                    listItem.dataset.checked = updatedNode.attrs.checked;
                    checkbox.checked = updatedNode.attrs.checked;
                    checkbox.ariaLabel = `Task item checkbox for ${updatedNode.textContent || 'empty task item'}`;

                    // Sync all HTML attributes from the updated node
                    const extensionAttributes = editor.extensionManager.attributes;
                    const newHTMLAttributes = getRenderedAttributes(updatedNode, extensionAttributes);
                    const newKeys = new Set(Object.keys(newHTMLAttributes));

                    const staticAttrs = this.options.HTMLAttributes;

                    prevRenderedAttributeKeys.forEach((key) => {
                        if (!newKeys.has(key)) {
                            if (key in staticAttrs) {
                                listItem.setAttribute(key, staticAttrs[key]);
                            } else {
                                listItem.removeAttribute(key);
                            }
                        }
                    });

                    Object.entries(newHTMLAttributes).forEach(([key, value]) => {
                        if (value === null || value === undefined) {
                            if (key in staticAttrs) {
                                listItem.setAttribute(key, staticAttrs[key]);
                            } else {
                                listItem.removeAttribute(key);
                            }
                        } else {
                            listItem.setAttribute(key, value);
                        }
                    });

                    prevRenderedAttributeKeys = newKeys;
                    return true;
                },
            };
        };
    },
});
