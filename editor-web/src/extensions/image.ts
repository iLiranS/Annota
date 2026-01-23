import { Image } from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';
import { sendMessage } from '../bridge';
import '../types'; // Import global window types

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
        return ({ node, getPos, editor }) => {
            const img = document.createElement('img');
            img.src = node.attrs.src;
            img.style.width = node.attrs.width || '100%';
            img.className = `img-${node.attrs.align || 'center'}`;
            img.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof getPos === 'function') {
                    const currentPos = getPos();
                    // Use raw transaction with scrollIntoView: false to avoid jumping to top
                    const nodeSelection = NodeSelection.create(editor.state.doc, currentPos);
                    editor.view.dispatch(
                        editor.state.tr
                            .setSelection(nodeSelection)
                            .setMeta('scrollIntoView', false)
                    );

                    // Collect all images in the document
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
                                position: pos
                            });
                        }
                    });

                    sendMessage({
                        type: 'imageSelected',
                        images,
                        currentIndex,
                        // Keep individual attrs for backwards compatibility
                        ...node.attrs,
                        originalWidth: img.naturalWidth,
                        currentWidth: img.width
                    });
                }
            };
            return {
                dom: img,
            };
        };
    },
});

export function setupImageUpdater() {
    window.updateImage = function (attrs) {
        if (window.editor && window.editor.isActive('image')) {
            let newAttrs = { ...attrs };

            // Handle Percentage Resizing to Pixels to support table cell shrinking
            // If we set width: 50%, the table cell might remain wide. We need explicit pixels.
            if (newAttrs.width && typeof newAttrs.width === 'string' && newAttrs.width.endsWith('%')) {
                const percent = parseInt(newAttrs.width, 10);

                // Convert percent to pixels relative to available space (editor width)
                // This prevents images from breaking tables or exceeding editor bounds
                const editorWidth = window.editor.view.dom.clientWidth || window.innerWidth;
                const selectedImg = document.querySelector('.ProseMirror-selectednode') as HTMLImageElement;

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

            window.editor.chain().focus().updateAttributes('image', newAttrs).run();
        }
    };
}
