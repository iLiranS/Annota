import type { NodeViewRenderer } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';
import { sendMessage } from '../bridge';
import '../types'; // Import global window types
import { createBlockMenuButton } from './block-menu-button';

export const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: '100%',
                renderHTML: attrs => ({ style: `width: ${attrs.width}; height: auto;` }),
                parseHTML: element => element.style.width || element.getAttribute('width'),
            },
            align: {
                default: 'center',
                renderHTML: attrs => ({ class: `img-${attrs.align}` }),
                parseHTML: element => {
                    if (element.classList.contains('img-left')) return 'left';
                    if (element.classList.contains('img-right')) return 'right';
                    return 'center';
                },
            }
        }
    },
    addNodeView() {
        return (({ node, getPos, editor }) => {
            // Wrapper container
            const wrapper = document.createElement('div');
            wrapper.className = `image-node-wrapper img-${node.attrs.align || 'center'}`;

            // Image element
            const img = document.createElement('img');
            img.src = node.attrs.src;
            img.style.width = node.attrs.width || '100%';
            img.draggable = false;

            // Helper: collect all images in the document
            const collectImages = (currentPos: number) => {
                const images: { src: string; width: string; position: number }[] = [];
                let currentIndex = 0;
                editor.state.doc.descendants((n, pos) => {
                    if (n.type.name === 'image') {
                        if (pos === currentPos) {
                            currentIndex = images.length;
                        }
                        images.push({
                            src: n.attrs.src,
                            width: n.attrs.width || '100%',
                            position: pos,
                        });
                    }
                });
                return { images, currentIndex };
            };

            // Helper: select this image node without scrolling
            const selectNode = (currentPos: number) => {
                const nodeSelection = NodeSelection.create(editor.state.doc, currentPos);
                editor.view.dispatch(
                    editor.state.tr
                        .setSelection(nodeSelection)
                        .setMeta('scrollIntoView', false)
                );
            };

            // Image click → open gallery
            img.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof getPos !== 'function') return;
                const currentPos = getPos();
                if (typeof currentPos !== 'number') return;
                selectNode(currentPos);
                const { images, currentIndex } = collectImages(currentPos);
                sendMessage({
                    type: 'imageSelected',
                    images,
                    currentIndex,
                });
            };

            // Three-dot menu button — shared utility
            const menuBtn = createBlockMenuButton({
                className: 'image-menu-btn',
                iconSize: 'small',
                onResolve: () => {
                    if (typeof getPos !== 'function') return null;
                    const currentPos = getPos();
                    if (typeof currentPos !== 'number') return null;
                    selectNode(currentPos);
                    return {
                        pos: currentPos,
                        message: {
                            type: 'openImageMenu',
                            src: node.attrs.src,
                            width: node.attrs.width || '100%',
                            position: currentPos,
                        },
                    };
                },
            });

            wrapper.appendChild(img);
            wrapper.appendChild(menuBtn);

            return {
                dom: wrapper,
                ignoreMutation: (mutation: MutationRecord) => {
                    return mutation.target === menuBtn || menuBtn.contains(mutation.target as Node);
                },
                update: (updatedNode) => {
                    if (updatedNode.type.name !== 'image') return false;
                    img.src = updatedNode.attrs.src;
                    img.style.width = updatedNode.attrs.width || '100%';
                    wrapper.className = `image-node-wrapper img-${updatedNode.attrs.align || 'center'}`;
                    return true;
                },
            };
        }) as NodeViewRenderer;
    },
});

export function setupImageUpdater() {
    window.updateImage = function (attrs) {
        if (!window.editor) return;
        const e = window.editor;
        let newAttrs = { ...attrs };

        // Handle Percentage Resizing to Pixels to support table cell shrinking
        // If we set width: 50%, the table cell might remain wide. We need explicit pixels.
        if (newAttrs.width && typeof newAttrs.width === 'string' && newAttrs.width.endsWith('%')) {
            const percent = parseInt(newAttrs.width, 10);

            // Convert percent to pixels relative to available space (editor width)
            // This prevents images from breaking tables or exceeding editor bounds
            const editorWidth = e.view.dom.clientWidth || window.innerWidth;
            // The selected node is now the wrapper div — find the img inside it
            const selectedWrapper = document.querySelector('.ProseMirror-selectednode');
            const selectedImg = (selectedWrapper?.tagName === 'IMG'
                ? selectedWrapper
                : selectedWrapper?.querySelector('img')) as HTMLImageElement | null;

            let baseWidth = editorWidth;

            // Trust natural width if it's smaller than editor width to avoid upscaling
            if (selectedImg && selectedImg.tagName === 'IMG' && selectedImg.naturalWidth) {
                baseWidth = Math.min(editorWidth, selectedImg.naturalWidth);
            } else if (selectedImg && selectedImg.tagName === 'IMG' && selectedImg.width) {
                // Fallback to current render width if natural not available (rare)
                baseWidth = Math.min(editorWidth, selectedImg.width);
            }

            // Calculate final pixel width
            const pxWidth = Math.floor((baseWidth * percent) / 100);
            newAttrs.width = `${pxWidth}px`;
        }

        // Try cursor-based path first
        if (e.isActive('image')) {
            e.chain().focus().updateAttributes('image', newAttrs).run();
            return;
        }

        // Fallback: use stored position from the menu
        const pos = window._lastBlockMenuPos;
        if (typeof pos === 'number') {
            const node = e.state.doc.nodeAt(pos);
            if (node?.type.name === 'image') {
                e.chain()
                    .command(({ tr }: any) => {
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            ...newAttrs,
                        });
                        return true;
                    })
                    .run();
            }
        }
    };
}
