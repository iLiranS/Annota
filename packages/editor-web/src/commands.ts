import { sendMessage, showError } from './bridge';
import { getEditorState } from './config';
import {
    applyFontFamily,
    scrollCursorIntoView,
    setupEditor
} from './editor-core';
import { hexToRgba } from './utils';

function copyImageAtPosition(pos: number): boolean {
    if (!window.editor) return false;
    const e = window.editor;
    const node = e.state.doc.nodeAt(pos);
    if (node?.type.name !== 'image') return false;

    e.chain().focus().setNodeSelection(pos).run();
    return document.execCommand('copy');
}

function findElementById(id: string): HTMLElement | null {
    return document.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
}

function expandDetailsAncestors(editor: any, targetEl: HTMLElement) {
    const tr = editor.state.tr;
    let didChange = false;

    editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name !== 'details' || node.attrs.open) return true;
        try {
            const domNode = editor.view.nodeDOM(pos) as HTMLElement | null;
            if (domNode && domNode.contains(targetEl)) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: true });
                didChange = true;
            }
        } catch {
            // Ignore transient DOM resolution failures during updates.
        }
        return true;
    });

    if (didChange) {
        editor.view.dispatch(tr);
    }
}

function scrollToElementById(editor: any, id: string): boolean {
    const target = findElementById(id);
    if (!target) return false;

    // Ensure collapsed details parents are opened before we attempt to scroll.
    expandDetailsAncestors(editor, target);

    const nextTarget = findElementById(id);
    if (!nextTarget) return false;

    nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    try {
        const pos = editor.view.posAtDOM(nextTarget as Node, 0);
        if (pos !== undefined && pos !== null) {
            editor.commands.setTextSelection(pos);
        }
    } catch {
        // If position lookup fails, keep the scroll result and skip cursor move.
    }

    return true;
}

function scrollToTopOfNote(editor: any) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    try {
        editor.commands.setTextSelection(1);
    } catch {
        // Ignore if document is temporarily not addressable.
    }
}

export function setupCommands() {
    window.handleCommand = function (command, params) {
        // Handle 'setOptions' command first, as it might initialize the editor
        if (command === 'setOptions') {
            if (params) {
                try {
                    setupEditor(params);
                } catch (e) {
                    console.error('Error in setupEditor:', e);
                    showError('Setup failed: ' + e);
                }
            }
            return; // Exit after handling setOptions
        }

        // For all other commands, an editor instance is required
        if (!window.editor) {
            return;
        }



        const e = window.editor;

        // Handle commands that shouldn't trigger a focus chain immediately
        if (command === 'setFontFamily') {
            applyFontFamily(params?.fontFamily);
            return;
        }

        if (command === 'setKeyboardHeight') {
            if (params?.height && params.height > 0) {
                // Keyboard is opening
                scrollCursorIntoView();
            } else {
                // Keyboard is closing - just update state, don't force blur
                // The blur happens naturally when user taps outside

            }
            return;
        }

        if (command === 'blur') {
            e.commands.blur();
            if (e.view && e.view.dom instanceof HTMLElement) {
                e.view.dom.blur();
            }
            document.getElementById('editor-content')?.blur();
            return;
        }

        const c = e.chain().focus();


        switch (command) {
            case 'toggleBold': c.toggleBold().run(); break;
            case 'toggleItalic': c.toggleItalic().run(); break;
            case 'toggleUnderline': c.toggleUnderline().run(); break;
            case 'toggleStrike': c.toggleStrike().run(); break;
            case 'toggleCode': c.toggleCode().run(); break;
            case 'toggleBulletList': c.toggleBulletList().run(); break;
            case 'toggleOrderedList': c.toggleOrderedList().run(); break;
            case 'toggleTaskList': c.toggleTaskList().run(); break;
            case 'sinkListItem': c.sinkListItem('listItem').run(); break;
            case 'liftListItem': c.liftListItem('listItem').run(); break;
            case 'toggleBlockquote': c.toggleBlockquote().run(); break;
            case 'toggleCodeBlock': c.toggleCodeBlock().run(); break;
            case 'toggleHeading': c.toggleHeading({ level: params?.level || 1 }).run(); break;
            case 'setContent':
                // Only set content if actually different or forcing update?
                // Actually, RN controls this. If it sends setContent, we set it.
                e.commands.setContent(params?.content);
                break;
            case 'getContent':
                sendMessage({ type: 'contentResponse', html: e.getHTML() });
                break;
            case 'focus':
                e.commands.focus('end');
                break;
            case 'undo': c.undo().run(); break;
            case 'redo': c.redo().run(); break;
            case 'setLink':
                if (params?.href) {
                    if (params.title && e.state.selection.empty) {
                        c.insertContent({
                            type: 'text',
                            text: params.title,
                            marks: [{ type: 'link', attrs: { href: params.href } }]
                        }).run();
                    } else {
                        c.setLink({ href: params.href }).run();
                    }
                }
                break;
            case 'unsetLink': c.unsetLink().run(); break;
            case 'setHighlight':
                let color = params?.color;
                if (color && color.startsWith('#') && color.length === 7) color += '4D';
                c.setHighlight({ color }).run();
                break;
            case 'unsetHighlight': c.unsetHighlight().run(); break;
            case 'setColor': c.setColor(params?.color).run(); break;
            case 'unsetColor': c.unsetColor().run(); break;
            case 'setYoutubeVideo':
                if (params?.src) c.setYoutubeVideo({ src: params.src }).run();
                break;
            case 'setImage':
                if (params?.src) c.setImage({ src: params.src }).run();
                break;
            case 'insertLocalImage':
                // Insert image node with imageId (no src yet — will be resolved)
                if (params?.imageId) {
                    c.setImage({ src: '', imageId: params.imageId } as any).run();
                }
                break;
            case 'resolveImages':
                // Inject base64 data URIs for imageId-based images
                if (params?.imageMap) {
                    window.resolveImages?.(params.imageMap);
                }
                break;
            case 'updateImage':
                window.updateImage?.(params);
                break;
            case 'replaceImageId':
                if (params?.oldId && params?.newId) {
                    let hasChanges = false;
                    const tr = e.state.tr;
                    e.state.doc.descendants((node, pos) => {
                        if (node.type.name === 'image' && node.attrs.imageId === params.oldId) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                imageId: params.newId
                            });
                            hasChanges = true;
                        }
                    });
                    if (hasChanges) {
                        e.view.dispatch(tr);
                    }
                }
                break;
            case 'deleteImage':
                if (typeof params?.pos === 'number') {
                    e.chain().setNodeSelection(params.pos).deleteSelection().run();
                } else if (e.isActive('image')) {
                    c.deleteSelection().run();
                }
                break;
            case 'cutImage': {
                const cutPos = params?.pos as number | undefined;
                if (typeof cutPos === 'number') {
                    if (copyImageAtPosition(cutPos)) {
                        e.chain().focus().setNodeSelection(cutPos).deleteSelection().run();
                    }
                }
                break;
            }
            case 'copyImage': {
                const copyPos = params?.pos as number | undefined;
                if (typeof copyPos === 'number') {
                    copyImageAtPosition(copyPos);
                }
                break;
            }
            case 'deleteSelection':
                if (typeof params?.pos === 'number') {
                    e.chain().focus().setNodeSelection(params.pos).deleteSelection().run();
                } else {
                    e.chain().focus().deleteSelection().run();
                }
                break;
            case 'copyToClipboard':
                // Use native web copy to preserve block structure (Rich Text/HTML)
                if (typeof params?.pos === 'number') {
                    e.chain().focus().setNodeSelection(params.pos).run();
                } else {
                    e.chain().focus().run();
                }
                document.execCommand('copy');
                // Optional: Unselect after copy if desired, but standard behavior usually keeps selection.
                // Given the user request to avoid visual selection *during menu*, selecting now is inevitable for copy.
                break;
            case 'copyBlockLink':
                if (params?.id) {
                    sendMessage({ type: 'copyBlockLink', id: params.id });
                }
                break;
            case 'insertTable':
                c.insertTable({ rows: params?.rows || 3, cols: params?.cols || 3, withHeaderRow: params?.withHeaderRow !== false }).run();
                break;
            case 'addRowBefore': c.addRowBefore().run(); break;
            case 'addRowAfter': c.addRowAfter().run(); break;
            case 'addColumnBefore': c.addColumnBefore().run(); break;
            case 'addColumnAfter': c.addColumnAfter().run(); break;
            case 'deleteRow': c.deleteRow().run(); break;
            case 'deleteColumn': c.deleteColumn().run(); break;
            case 'deleteTable': c.deleteTable().run(); break;
            case 'setCellBackground':
                if (params?.color) {
                    // Add alpha for lower opacity (similar to highlight)
                    let bgColor = params.color;
                    if (bgColor.startsWith('#') && bgColor.length === 7) bgColor += '4D'; // ~30% opacity
                    e.chain().focus().setCellAttribute('backgroundColor', bgColor).run();
                }
                break;
            case 'unsetCellBackground':
                e.chain().focus().setCellAttribute('backgroundColor', null).run();
                break;
            case 'setCodeBlockLanguage':
                if (params?.language) c.updateAttributes('codeBlock', { language: params.language }).run();
                break;
            case 'selectImageAtPosition':
                // Don't use focus() here - we're just selecting for gallery navigation
                // Focus would trigger the keyboard
                if (typeof params?.position === 'number') {
                    e.chain().setNodeSelection(params.position).run();
                }
                break;
            case 'setMath':
                if (params?.latex) {
                    const { selection } = e.state;
                    const isMathNode = 'node' in selection && selection.node &&
                        // @ts-ignore
                        ['inlineMath', 'blockMath'].includes(selection.node.type.name);

                    if (isMathNode && selection.node) {
                        // @ts-ignore
                        c.updateAttributes(selection.node.type.name, { latex: params.latex }).run();
                    } else {
                        // Insert new inline math
                        c.insertContent({
                            type: 'inlineMath',
                            attrs: { latex: params.latex }
                        }).run();
                    }
                }
                break;
            case 'toggleDetails':
                // Check if we're in a details node
                if (e.isActive('details')) {
                    e.chain().focus().unsetDetails().run();
                } else {
                    e.chain().focus().setDetails().run();
                }
                break;
            case 'setDetailsBackground': {
                if (params?.color) {
                    let bgColor = params.color;
                    // Use hexToRgba for 15% opacity (approx 0.15)
                    if (bgColor.startsWith('#')) {
                        bgColor = hexToRgba(bgColor, 0.3);
                    }

                    // Try to use the stored block position from the menu to find the details node
                    const detailsPos = window._lastBlockMenuPos;
                    if (typeof detailsPos === 'number') {
                        const detailsNode = e.state.doc.nodeAt(detailsPos);
                        if (detailsNode?.type.name === 'details') {
                            // Directly set the attribute on the node using its position
                            e.chain()
                                .command(({ tr }: any) => {
                                    tr.setNodeMarkup(detailsPos, undefined, {
                                        ...detailsNode.attrs,
                                        backgroundColor: bgColor,
                                    });
                                    return true;
                                })
                                .run();
                        } else {
                            // Fallback: focus and use updateAttributes
                            e.chain().focus().setDetailsBackground(bgColor).run();
                        }
                    } else {
                        // Fallback: focus and use updateAttributes
                        e.chain().focus().setDetailsBackground(bgColor).run();
                    }

                    // Force immediate DOM update to prevent lag if NodeView doesn't re-render immediately
                    setTimeout(() => {
                        try {
                            const domNode = typeof detailsPos === 'number'
                                ? e.view.nodeDOM(detailsPos) as HTMLElement | null
                                : null;
                            const detailsEl = domNode?.closest?.('[data-type="details"]') as HTMLElement
                                ?? domNode;
                            if (detailsEl && detailsEl.getAttribute('data-type') === 'details') {
                                detailsEl.style.backgroundColor = bgColor;
                            }
                        } catch (err) {
                            console.warn('Failed to force update details background:', err);
                        }
                    }, 0);
                }
                break;
            }
            case 'unsetDetailsBackground': {
                const unsetPos = window._lastBlockMenuPos;
                if (typeof unsetPos === 'number') {
                    const detailsNode = e.state.doc.nodeAt(unsetPos);
                    if (detailsNode?.type.name === 'details') {
                        e.chain()
                            .command(({ tr }: any) => {
                                tr.setNodeMarkup(unsetPos, undefined, {
                                    ...detailsNode.attrs,
                                    backgroundColor: null,
                                });
                                return true;
                            })
                            .run();
                    } else {
                        e.chain().focus().unsetDetailsBackground().run();
                    }
                } else {
                    e.chain().focus().unsetDetailsBackground().run();
                }
                break;
            }
            // Search commands
            case 'search':
                e.commands.search(params?.term || '');
                break;
            case 'searchNext':
                e.commands.searchNext();
                break;
            case 'searchPrev':
                e.commands.searchPrev();
                break;
            case 'clearSearch':
                e.commands.clearSearch();
                break;
            case 'scrollToElement':
                if (params?.id) {
                    const didScroll = scrollToElementById(e, params.id);
                    if (!didScroll) {
                        let attempt = 0;
                        const maxAttempts = 180; // ~3s max wait for slow doc mount/hydration
                        const tryScroll = () => {
                            attempt += 1;
                            if (scrollToElementById(e, params.id)) {
                                return;
                            }
                            if (attempt < maxAttempts) {
                                requestAnimationFrame(tryScroll);
                                return;
                            }

                            // Element doesn't exist (or no longer exists): fall back to note top.
                            scrollToTopOfNote(e);
                        };
                        requestAnimationFrame(tryScroll);
                    }
                }
                break;
        }

        if (command !== 'getContent') {
            setTimeout(() => sendMessage({ type: 'state', state: getEditorState(window.editor) }), 50);
        }
    };
}
