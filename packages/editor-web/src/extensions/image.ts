import type { NodeViewRenderer } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, type EditorState, type Transaction } from '@tiptap/pm/state';
import { sendMessage } from '../bridge';
import '../types'; // Import global window types
import { createBlockMenuButton } from './block-menu-button';

const INTERNAL_IMAGE_ID_MIME = 'application/x-note-image-id';

function escapeHtmlAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function dataUriToFile(dataUri: string): File | null {
    const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!match) return null;

    const mimeType = match[1].toLowerCase();
    const base64 = match[2];

    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const extension = mimeType.split('/')[1] || 'png';
        return new File([bytes], `image.${extension}`, { type: mimeType });
    } catch {
        return null;
    }
}

function setImageClipboardPayload(event: ClipboardEvent, imageId: string | null, src: string | null) {
    if (!event.clipboardData) return false;

    const normalizedId = imageId ? String(imageId) : '';
    const normalizedSrc = src ? String(src) : '';

    if (normalizedId) {
        event.clipboardData.setData(INTERNAL_IMAGE_ID_MIME, normalizedId);
    }

    if (normalizedSrc) {
        const safeSrc = escapeHtmlAttr(normalizedSrc);
        const safeId = normalizedId ? ` data-note-image-id="${escapeHtmlAttr(normalizedId)}"` : '';
        event.clipboardData.setData('text/html', `<img src="${safeSrc}" alt="[Image]"${safeId} />`);

        // Best-effort: also attach a real image item for external paste targets
        // that ignore HTML but accept image clipboard data.
        const imageFile = dataUriToFile(normalizedSrc);
        if (imageFile && event.clipboardData.items?.add) {
            try {
                event.clipboardData.items.add(imageFile);
            } catch {
                // Ignore if this WebView/runtime doesn't allow adding file items.
            }
        }
    }

    event.clipboardData.setData('text/plain', '[Image]');
    event.preventDefault();
    return true;
}

function getCopiedImageId(clipboardData: DataTransfer | null | undefined): string | null {
    if (!clipboardData) return null;

    const direct = clipboardData.getData(INTERNAL_IMAGE_ID_MIME).trim();
    if (direct) return direct;

    // Fallback when custom MIME types are stripped but HTML remains.
    const html = clipboardData.getData('text/html');
    if (!html) return null;
    const match = html.match(/data-note-image-id=["']([^"']+)["']/i);
    return match?.[1]?.trim() || null;
}

export const CustomImage = Image.extend<any>({
    addOptions() {
        return {
            ...this.parent?.(),
            onImageSelected: null as ((data: { images: any[], currentIndex: number }) => void) | null,
            onOpenImageMenu: null as ((e: MouseEvent, resolve: () => any) => void) | null,
            onImagePasted: null as ((data: { base64: string, imageId: string }) => void) | null,
            onResolveImageIds: null as ((data: { imageIds: string[] }) => void) | null,
        };
    },
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
            },
            imageId: {
                default: null,
                parseHTML: element => element.getAttribute('data-image-id'),
                renderHTML: attributes => {
                    if (!attributes.imageId) return {};
                    return { 'data-image-id': attributes.imageId };
                },
            },
        }
    },
    addCommands() {
        return {
            resolveImages: ({ imageMap }: { imageMap: Record<string, string> }) => ({ tr, state, dispatch }: { tr: Transaction, state: EditorState, dispatch?: (tr: Transaction) => void }) => {
                let hasChanges = false;
                state.doc.descendants((node: PMNode, pos: number) => {
                    if (node.type.name === 'image' && node.attrs.imageId) {
                        const dataUri = imageMap[node.attrs.imageId];
                        if (dataUri && node.attrs.src !== dataUri) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                src: dataUri,
                            });
                            hasChanges = true;
                        }
                    }
                });

                if (hasChanges && dispatch) {
                    tr.setMeta('resolveImages', true);
                    dispatch(tr);
                }
                return hasChanges;
            },
            replaceImageId: ({ oldId, newId, src }: { oldId: string, newId: string, src?: string }) => ({ tr, state, dispatch }: { tr: Transaction, state: EditorState, dispatch?: (tr: Transaction) => void }) => {
                let hasChanges = false;
                state.doc.descendants((node: PMNode, pos: number) => {
                    if (node.type.name === 'image' && node.attrs.imageId === oldId) {
                        tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            imageId: newId,
                            src: src || node.attrs.src,
                        });
                        hasChanges = true;
                    }
                });

                if (hasChanges && dispatch) {
                    dispatch(tr);
                }
                return hasChanges;
            },
            // Legacy/bridge support
            insertLocalImage: ({ imageId }: { imageId: string }) => ({ chain }: { chain: any }) => {
                return (chain() as any).insertContent(`<img data-image-id="${imageId}" />`).run();
            }
        } as any;
    },
    addNodeView() {
        return (({ node, getPos, editor }) => {
            let currentNode = node;

            // Wrapper container
            const wrapper = document.createElement('div');
            wrapper.className = `image-node-wrapper img-${currentNode.attrs.align || 'center'}`;

            // Image element
            const img = document.createElement('img');
            if (currentNode.attrs.src) {
                img.src = currentNode.attrs.src;
            } else {
                // Placeholder for unresolved imageId images
                img.style.backgroundColor = 'var(--border-color, #e0e0e0)';
                img.style.minHeight = '100px';
            }
            img.style.width = currentNode.attrs.width || '100%';
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
                if (this.options.onImageSelected) {
                    this.options.onImageSelected({
                        images,
                        currentIndex,
                    });
                } else {
                    sendMessage({
                        type: 'imageSelected',
                        images,
                        currentIndex,
                    });
                }
            };

            // Three-dot menu button — shared utility
            const menuBtn = createBlockMenuButton({
                className: 'image-menu-btn',
                iconSize: 'small',
                onClick: this.options.onOpenImageMenu,
                onResolve: () => {
                    if (typeof getPos !== 'function') return null;
                    const currentPos = getPos();
                    if (typeof currentPos !== 'number') return null;
                    selectNode(currentPos);
                    return {
                        pos: currentPos,
                        message: {
                            type: 'openImageMenu',
                            imageId: currentNode.attrs.imageId,
                            src: currentNode.attrs.src,
                            width: currentNode.attrs.width || '100%',
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
                    currentNode = updatedNode;

                    if (updatedNode.attrs.src) {
                        img.src = updatedNode.attrs.src;
                        img.style.backgroundColor = '';
                        img.style.minHeight = '';
                    }
                    img.style.width = updatedNode.attrs.width || '100%';
                    wrapper.className = `image-node-wrapper img-${updatedNode.attrs.align || 'center'}`;
                    return true;
                },
            };
        }) as NodeViewRenderer;
    },
    addProseMirrorPlugins() {
        const options = this.options;
        return [
            new Plugin({
                props: {
                    handleDOMEvents: {
                        copy(view, event) {
                            const clipboardEvent = event as ClipboardEvent;
                            const selection = view.state.selection;
                            if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') {
                                return false;
                            }

                            const imageId = selection.node.attrs.imageId ?? null;
                            const src = selection.node.attrs.src ?? null;
                            return setImageClipboardPayload(clipboardEvent, imageId, src);
                        },
                        cut(view, event) {
                            const clipboardEvent = event as ClipboardEvent;
                            const selection = view.state.selection;
                            if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') {
                                return false;
                            }

                            const imageId = selection.node.attrs.imageId ?? null;
                            const src = selection.node.attrs.src ?? null;
                            const copied = setImageClipboardPayload(clipboardEvent, imageId, src);
                            if (!copied) return false;

                            view.dispatch(view.state.tr.deleteSelection());
                            return true;
                        },
                    },
                    handlePaste(view, event) {
                        const items = Array.from(event.clipboardData?.items || []);
                        const { schema } = view.state;

                        // 1. Internal copy/paste path: reuse existing imageId (no re-upload).
                        const internalImageId = getCopiedImageId(event.clipboardData);
                        if (internalImageId) {
                            const node = schema.nodes.image.create({ src: '', imageId: internalImageId });
                            const transaction = view.state.tr.replaceSelectionWith(node);
                            view.dispatch(transaction);
                            if (options.onResolveImageIds) {
                                options.onResolveImageIds({ imageIds: [internalImageId] });
                            } else {
                                sendMessage({ type: 'resolveImageIds', imageIds: [internalImageId] });
                            }
                            return true;
                        }

                        // 2. Handle Image Files (external paste).
                        for (const item of items) {
                            if (item.type.indexOf('image') === 0) {
                                const file = item.getAsFile();
                                if (!file) continue;

                                const reader = new FileReader();
                                reader.onload = (readerEvent) => {
                                    const base64 = readerEvent.target?.result;
                                    if (typeof base64 === 'string') {
                                        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                                        const node = schema.nodes.image.create({
                                            src: base64,
                                            imageId: tempId
                                        });
                                        const transaction = view.state.tr.replaceSelectionWith(node);
                                        view.dispatch(transaction);
                                        if (options.onImagePasted) {
                                            options.onImagePasted({ base64, imageId: tempId });
                                        } else {
                                            sendMessage({ type: 'imagePasted', base64, imageId: tempId });
                                        }
                                    }
                                };
                                reader.readAsDataURL(file);
                                return true;
                            }
                        }

                        // 3. Handle Base64 Text and Native Text Fallback
                        const text = event.clipboardData?.getData('text/plain');

                        // Handle native image copying fallback
                        const nativeIdMatch = text?.match(/^\[\[ImageID:(.+)\]\]$/);
                        if (nativeIdMatch) {
                            const internalImageId = nativeIdMatch[1].trim();
                            const node = schema.nodes.image.create({ src: '', imageId: internalImageId });
                            const transaction = view.state.tr.replaceSelectionWith(node);
                            view.dispatch(transaction);
                            if (options.onResolveImageIds) {
                                options.onResolveImageIds({ imageIds: [internalImageId] });
                            } else {
                                sendMessage({ type: 'resolveImageIds', imageIds: [internalImageId] });
                            }
                            return true;
                        }

                        if (text && text.trim().startsWith('data:image/')) {
                            const trimmed = text.trim();
                            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                            const node = schema.nodes.image.create({ src: trimmed, imageId: tempId });
                            const transaction = view.state.tr.replaceSelectionWith(node);
                            view.dispatch(transaction);
                            if (options.onImagePasted) {
                                options.onImagePasted({ base64: trimmed, imageId: tempId });
                            } else {
                                sendMessage({ type: 'imagePasted', base64: trimmed, imageId: tempId });
                            }
                            return true;
                        }

                        return false;
                    },
                },
            }),
        ];
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

/**
 * Sets up window.resolveImages for RN to inject base64 data URIs
 * into image nodes identified by imageId.
 */
export function setupImageResolver() {
    window.resolveImages = function (imageMap: Record<string, string>) {
        if (!window.editor) return;
        (window.editor.commands as any).resolveImages({ imageMap });
    };
}
