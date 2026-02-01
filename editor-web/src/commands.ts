import { sendMessage, showError } from './bridge';
import {
    getEditorState,
    scrollCursorIntoView,
    setupEditor
} from './editor-core';
import { hexToRgba } from './utils';

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
                if (params?.href) c.setLink({ href: params.href }).run();
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
            case 'updateImage':
                window.updateImage?.(params);
                break;
            case 'deleteImage':
                if (e.isActive('image')) {
                    c.deleteSelection().run();
                }
                break;
            case 'cutImage':
                if (e.isActive('image')) {
                    document.execCommand('cut');
                }
                break;
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
                if (typeof params?.position === 'number') {
                    e.chain().focus().setNodeSelection(params.position).run();
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
            case 'setDetailsBackground':
                if (params?.color) {
                    let bgColor = params.color;
                    // Use hexToRgba for 15% opacity (approx 0.15)
                    if (bgColor.startsWith('#')) {
                        bgColor = hexToRgba(bgColor, 0.3);
                    }
                    e.chain().focus().setDetailsBackground(bgColor).run();

                    // Force immediate DOM update to prevent lag if NodeView doesn't re-render immediately
                    setTimeout(() => {
                        try {
                            const { from } = e.state.selection;
                            const domInfo = e.view.domAtPos(from);
                            const target = domInfo.node instanceof HTMLElement
                                ? domInfo.node
                                : domInfo.node.parentElement;

                            const detailsEl = target?.closest('[data-type="details"]') as HTMLElement;
                            if (detailsEl) {
                                detailsEl.style.backgroundColor = bgColor;
                            }
                        } catch (err) {
                            console.warn('Failed to force update details background:', err);
                        }
                    }, 0);
                }
                break;
            case 'unsetDetailsBackground':
                e.chain().focus().unsetDetailsBackground().run();
                break;
        }

        if (command !== 'getContent') {
            setTimeout(() => sendMessage({ type: 'state', state: getEditorState() }), 50);
        }
    };
}
