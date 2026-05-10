import { sendMessage, showError } from './bridge';
import { dispatchEditorCommand } from './command-dispatcher';
import { getEditorState } from './config';
import {
    applyFontFamily,
    scrollCursorIntoView,
    setupEditor
} from './editor-core';
import './extensions/details';

function copyImageAtPosition(pos: number): boolean {
    if (!window.editor) return false;
    const e = window.editor;
    const node = e.state.doc.nodeAt(pos);
    if (node?.type.name !== 'image') return false;

    e.chain().focus().setNodeSelection(pos).run();
    return document.execCommand('copy');
}

export function setupCommands() {
    window.handleCommand = async function (command, params) {
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

        let handled = false;

        switch (command) {
            case 'setFontFamily':
                applyFontFamily(params?.fontFamily);
                handled = true;
                break;
            case 'setKeyboardHeight':
                if (params?.height && params.height > 0) {
                    scrollCursorIntoView();
                }
                handled = true;
                break;
            case 'blur':
                e.commands.blur();
                if (e.view && e.view.dom instanceof HTMLElement) {
                    e.view.dom.blur();
                }
                document.getElementById('editor-content')?.blur();
                handled = true;
                break;
            case 'focus':
                e.commands.focus('end');
                handled = true;
                break;
            case 'setContent':
                (window as any)._lastSentHtml = params?.content;
                e.commands.setContent(params?.content);
                handled = true;
                break;
            case 'getContent':
                sendMessage({ type: 'contentResponse', html: e.getHTML() });
                handled = true;
                break;
            case 'insertLocalImage':
                if (params?.imageId) {
                    e.chain().focus().insertContent({
                        type: 'image',
                        attrs: {
                            imageId: params.imageId,
                            src: params.src || ''
                        }
                    }).run();
                }
                handled = true;
                break;
            case 'insertFileAttachment':
                if (params?.fileId) {
                    (e.commands as any).insertFileAttachment(params);
                }
                handled = true;
                break;
            case 'resolveImages':
                if (params?.imageMap) {
                    window.resolveImages?.(params.imageMap);
                }
                handled = true;
                break;
            case 'replaceImageId':
                if (params?.oldId && params?.newId) {
                    let hasChanges = false;
                    const tr = e.state.tr;
                    e.state.doc.descendants((node, pos) => {
                        if (node.type.name === 'image' && node.attrs.imageId === params.oldId) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                imageId: params.newId,
                                src: params.src || node.attrs.src
                            });
                            hasChanges = true;
                        }
                    });
                    if (hasChanges) {
                        e.view.dispatch(tr);
                    }
                }
                handled = true;
                break;
            case 'cutImage': {
                const cutPos = params?.pos as number | undefined;
                if (typeof cutPos === 'number') {
                    if (copyImageAtPosition(cutPos)) {
                        e.chain().focus().setNodeSelection(cutPos).deleteSelection().run();
                    }
                }
                handled = true;
                break;
            }
            case 'copyImage': {
                const copyPos = params?.pos as number | undefined;
                if (typeof copyPos === 'number') {
                    copyImageAtPosition(copyPos);
                }
                handled = true;
                break;
            }
            case 'copyToClipboard':
                // We let command-dispatcher handle copyToClipboard as it has better rich-text support!
                break;
            case 'copyBlockLink':
                if (params?.id) {
                    sendMessage({ type: 'copyBlockLink', id: params.id });
                }
                handled = true;
                break;
            case 'selectImageAtPosition':
                if (typeof params?.position === 'number') {
                    e.chain().setNodeSelection(params.position).run();
                }
                handled = true;
                break;
            case 'search':
                e.commands.search(params?.term || '');
                handled = true;
                break;
            case 'searchNext':
                e.commands.searchNext();
                handled = true;
                break;
            case 'searchPrev':
                e.commands.searchPrev();
                handled = true;
                break;
            case 'clearSearch':
                e.commands.clearSearch();
                handled = true;
                break;
            case 'scrollToElement': {
                const { id } = params;
                if (!window.editor) { handled = true; break; }

                let attempts = 0;
                const maxAttempts = 120; // ~2 seconds

                const tryFindAndScroll = () => {
                    let targetPos = -1;
                    e.state.doc.descendants((node, pos) => {
                        if (node.attrs.id === id || node.attrs.blockId === id) {
                            targetPos = pos;
                            return false;
                        }
                    });

                    let targetDom: HTMLElement | null = null;

                    if (targetPos !== -1) {
                        const nodeDom = e.view.nodeDOM(targetPos);
                        targetDom = (nodeDom?.nodeType === 1 ? nodeDom : nodeDom?.parentElement) as HTMLElement;
                    } else {
                        targetDom = (document.getElementById(id) ||
                            document.querySelector(`[data-id="${id}"]`) ||
                            document.querySelector(`[blockId="${id}"]`)) as HTMLElement | null;
                    }

                    if (targetDom) {
                        const detailsAncestor = targetDom.closest('details');
                        if (detailsAncestor && !detailsAncestor.open) {
                            detailsAncestor.open = true;
                        }

                        // CRITICAL FOR MOBILE: Calculate absolute Y position
                        const rect = targetDom.getBoundingClientRect();
                        const yOffset = rect.top + window.scrollY;

                        if (targetPos !== -1) {
                            e.commands.setTextSelection(targetPos);
                        }

                        // Tell React Native's ScrollView exactly where to scroll!
                        // Subtract 50px so it sits comfortably below the top edge
                        sendMessage({ type: 'scrollToNative', y: Math.max(0, yOffset - 50) });
                        return;
                    }

                    if (attempts < maxAttempts) {
                        attempts++;
                        requestAnimationFrame(tryFindAndScroll);
                    }
                };

                tryFindAndScroll();
                handled = true;
                break;
            }
        }

        if (!handled) {
            handled = await dispatchEditorCommand(e, command, params);
        }

        if (handled && command !== 'getContent') {
            setTimeout(() => sendMessage({ type: 'state', state: getEditorState(window.editor) }), 50);
        }
    };
}
