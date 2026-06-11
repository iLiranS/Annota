import { mergeAttributes } from '@tiptap/core';
import { Blockquote } from '@tiptap/extension-blockquote';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { COLOR_PALETTE } from '../../../../core/constants/colors';
import { createBlockMenuButton } from './block-menu-button';
import './quote.css';

/** Strip the `dir` attribute so quote nodes inherit direction from the editor root */
function stripDir(attrs: Record<string, any>): Record<string, any> {
    const { dir, ...rest } = attrs;
    return rest;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        quote: {
            setQuoteBackground: (color: string) => ReturnType;
            unsetQuoteBackground: () => ReturnType;
        }
    }
}

const DEFAULT_GRAY_COLOR = COLOR_PALETTE.find(c => c.name === 'Gray')?.value + '15' || '#75757515';

export const Quote = Blockquote.extend<any>({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: DEFAULT_GRAY_COLOR,
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
            const attrs = mergeAttributes(stripDir(HTMLAttributes), { 'data-type': 'quote' });
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

            container.setAttribute('data-node-view-wrapper', '');

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
                    if (!content.contains(mutation.target as Node) && content !== mutation.target) {
                        return true;
                    }
                    return false;
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

    addProseMirrorPlugins() {
        const parentPlugins = this.parent?.() || [];

        return [
            ...parentPlugins,
            new Plugin({
                key: new PluginKey('no-quote-nesting'),
                props: {
                    handleDrop(view, event, slice) {
                        if (!event) return false;

                        let isDraggingQuote = false;
                        slice.content.descendants((node) => {
                            if (node.type.name === 'blockquote') {
                                isDraggingQuote = true;
                            }
                        });

                        if (!isDraggingQuote) return false;

                        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                        if (!pos) return false;

                        const $pos = view.state.doc.resolve(pos.pos);
                        for (let i = $pos.depth; i > 0; i--) {
                            if ($pos.node(i).type.name === 'blockquote') {
                                event.preventDefault();
                                return true; // Blocks the drop safely
                            }
                        }
                        return false;
                    }
                }
            })
        ];
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
