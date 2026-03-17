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

        if (dispatchEditorCommand(e, command, params)) {
            if (command !== 'getContent') {
                setTimeout(() => sendMessage({ type: 'state', state: getEditorState(window.editor) }), 50);
            }
            return;
        }

        switch (command) {
            case 'setFontFamily':
                applyFontFamily(params?.fontFamily);
                return;
            case 'setKeyboardHeight':
                if (params?.height && params.height > 0) {
                    scrollCursorIntoView();
                }
                return;
            case 'blur':
                e.commands.blur();
                if (e.view && e.view.dom instanceof HTMLElement) {
                    e.view.dom.blur();
                }
                document.getElementById('editor-content')?.blur();
                return;
            case 'focus':
                e.commands.focus('end');
                break;
            case 'setContent':
                e.commands.setContent(params?.content);
                break;
            case 'getContent':
                sendMessage({ type: 'contentResponse', html: e.getHTML() });
                return;
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
                break;
            case 'resolveImages':
                if (params?.imageMap) {
                    window.resolveImages?.(params.imageMap);
                }
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
            case 'copyToClipboard':
                if (typeof params?.pos === 'number') {
                    e.chain().focus().setNodeSelection(params.pos).run();
                } else {
                    e.chain().focus().run();
                }
                document.execCommand('copy');
                break;
            case 'copyBlockLink':
                if (params?.id) {
                    sendMessage({ type: 'copyBlockLink', id: params.id });
                }
                break;
            case 'selectImageAtPosition':
                if (typeof params?.position === 'number') {
                    e.chain().setNodeSelection(params.position).run();
                }
                break;
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
                        const maxAttempts = 180;
                        const tryScroll = () => {
                            attempt += 1;
                            if (scrollToElementById(e, params.id)) {
                                return;
                            }
                            if (attempt < maxAttempts) {
                                requestAnimationFrame(tryScroll);
                                return;
                            }
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
