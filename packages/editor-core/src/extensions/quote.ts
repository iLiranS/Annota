import { Blockquote } from '@tiptap/extension-blockquote';
import { mergeAttributes } from '@tiptap/core';
import { createBlockMenuButton } from './block-menu-button';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        quote: {
            setQuoteBackground: (color: string) => ReturnType;
            unsetQuoteBackground: () => ReturnType;
        }
    }
}

export const Quote = Blockquote.extend<any>({
    addAttributes() {
        return {
            ...this.parent?.(),
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

    addOptions() {
        return {
            ...this.parent?.(),
            onOpenBlockMenu: null,
        };
    },

    addNodeView() {
        return ({ node, getPos, HTMLAttributes }) => {
            const container = document.createElement('div');
            container.classList.add('quote-wrapper');

            const content = document.createElement('blockquote');
            // We use mergeAttributes to ensure any other blockquote attributes are preserved
            const attrs = mergeAttributes(HTMLAttributes, { 'data-type': 'quote' });
            Object.entries(attrs).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    content.setAttribute(key as string, value as string);
                }
            });

            // Apply background to container and derive border color for blockquote
            const applyStyles = (bgColor: string | null) => {
                if (bgColor) {
                    container.style.backgroundColor = bgColor;
                    // Deriving border color: if it's a hex with alpha (9 chars), use the opaque version (7 chars)
                    if (bgColor.startsWith('#') && bgColor.length === 9) {
                        content.style.borderInlineStartColor = bgColor.substring(0, 7);
                    } else {
                        content.style.borderInlineStartColor = bgColor;
                    }
                } else {
                    container.style.backgroundColor = '';
                    content.style.borderInlineStartColor = '';
                }
            };

            applyStyles(node.attrs.backgroundColor);

            const menuBtn = createBlockMenuButton({
                className: 'quote-menu-btn',
                iconSize: 'small',
                onResolve: () => {
                    if (typeof getPos !== 'function') return null;
                    const pos = getPos();
                    if (typeof pos !== 'number') return null;
                    
                    return {
                        pos,
                        message: {
                            type: 'openBlockMenu',
                            blockType: 'quote',
                            backgroundColor: node.attrs.backgroundColor,
                            pos: pos,
                        },
                    };
                },
                onClick: this.options.onOpenBlockMenu,
            });

            container.appendChild(menuBtn);
            container.appendChild(content);

            return {
                dom: container,
                contentDOM: content,
                update: (newNode) => {
                    if (newNode.type.name !== node.type.name) return false;
                    
                    if (newNode.attrs.backgroundColor !== node.attrs.backgroundColor) {
                        applyStyles(newNode.attrs.backgroundColor);
                    }
                    
                    node = newNode;
                    return true;
                },
                ignoreMutation: (mutation) => {
                    const target = mutation.target as Node;
                    return menuBtn.contains(target);
                },
                stopEvent: (e) => {
                    const target = e.target as Node;
                    return menuBtn.contains(target);
                },
            };
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Shift-u': () => this.editor.commands.toggleBlockquote(),
            'Mod-Shift-b': () => false,
        };
    },

    addCommands() {
        return {
            ...this.parent?.(),
            setQuoteBackground:
                (color: string) =>
                    ({ commands }: { commands: any }) => {
                        return commands.updateAttributes('blockquote', { backgroundColor: color });
                    },
            unsetQuoteBackground:
                () =>
                    ({ commands }: { commands: any }) => {
                        return commands.updateAttributes('blockquote', { backgroundColor: null });
                    },
        };
    },
});
