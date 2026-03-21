import { Editor } from '@tiptap/core';
import { migrateMathStrings } from '@tiptap/extension-mathematics';
import { loadingEl, sendMessage, showError } from './bridge';
import { getEditorProps, getEditorState, getExtensions, resolveFontFamily } from './config';
import './types';
import { hexToRgba } from './utils';

// DOM Elements
export const editorEl = document.getElementById('editor-content')!;


// We no longer have "display mode", so editor is always "formatting" accessible, 
// but we might want to handle ReadOnly state if requested by Native. 
// For now, assume always active.

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentFontFamily: string | null = null;
export let currentDefaultCodeLanguage: string | null = null;
let hasAppliedFontToContent = false;
let heightObserver: ResizeObserver | null = null;
/**
 * When true, `onUpdate` will NOT send content messages back to React Native.
 * Used during initial editor setup to prevent spurious content updates caused
 * by `applyFontFamily`, `migrateMathStrings`, and the autofocus heading
 * insertion — none of which represent real user edits.
 */
let suppressContentUpdates = false;

const editorOrigin = (() => {
    try {
        if (typeof window === 'undefined') return '';
        const origin = window.location?.origin;
        return origin && origin !== 'null' ? origin : '';
    } catch {
        return '';
    }
})();

function applyFontFamilyToContent(value?: string) {
    if (!window.editor) return;
    const normalized = (value ?? 'system').toLowerCase();

    if (normalized === 'system' || normalized === 'system (default)') {
        window.editor.commands.unsetFontFamily();
    } else {
        window.editor.chain().selectAll().setFontFamily(resolveFontFamily(value)).run();
    }

    hasAppliedFontToContent = true;
}

export function applyFontFamily(value?: string) {
    const resolved = resolveFontFamily(value);
    const normalized = (value ?? 'system').toLowerCase();

    if (currentFontFamily === normalized && hasAppliedFontToContent) {
        return;
    }

    const container = document.getElementById('editor-container') || document.documentElement;
    container.style.setProperty('--editor-font-family', resolved);
    document.body.style.fontFamily = resolved;
    editorEl.style.fontFamily = resolved;

    applyFontFamilyToContent(value);
    currentFontFamily = normalized;
}

// --- Logic ---


let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scrollCursorIntoView() {
    if (!window.editor) return;

    // Debounce to avoid excessive calls
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
        if (!window.editor || !window.editor.isFocused) return;

        try {
            const { from } = window.editor.state.selection;
            const coords = window.editor.view.coordsAtPos(from);
            if (!coords) return;

            sendMessage({
                type: 'cursorPosition',
                top: coords.top,
                bottom: coords.bottom
            });
        } catch (e) {
            // Silently fail - don't break the editor
        }
    }, 50);
}


// Inside editor-core.ts
const serializeCommandData = (data: any) => {
    let rect = null;
    try {
        // Mobile webviews sometimes freak out when getting rects of empty text nodes
        if (typeof data.clientRect === 'function') {
            const domRect = data.clientRect();
            if (domRect) {
                rect = {
                    top: domRect.top, bottom: domRect.bottom,
                    left: domRect.left, right: domRect.right,
                    width: domRect.width, height: domRect.height,
                    x: domRect.x, y: domRect.y
                };
            }
        }
    } catch (e) {
        console.warn("Failed to serialize clientRect", e);
    }
    return { ...data, clientRect: rect };
};


// Setup logic
// We accept options to configure the editor initial state
export function setupEditor(options: any) {
    const {
        isDark = false,
        colors = {},
        content = '',
        placeholder = 'Write something...',
        autofocus = false,
        paddingTop = 0,
        direction = 'auto',
        fontFamily = 'system',
        fontSize = 16,
        lineSpacing = 1.5,
        noteWidth = 0,
        defaultCodeLanguage = null
    } = options;

    // Set CSS variables for theme
    const container = document.getElementById('editor-container') || document.documentElement;
    container.style.setProperty('--bg-color', colors.background);
    container.style.setProperty('--text-color', colors.text);
    container.style.setProperty('--accent-color', colors.primary);
    container.style.setProperty('--placeholder-color', isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
    container.style.setProperty('--code-bg', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
    container.style.setProperty('--code-block-bg', isDark ? '#1E1E1E' : '#F5F5F5');
    container.style.setProperty('--border-color', isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
    container.style.setProperty('--quote-bg', hexToRgba(colors.primary, 0.2));
    container.style.setProperty('--editor-font-size', `${fontSize}px`);
    container.style.setProperty('--editor-line-height', `${lineSpacing}`);
    container.style.setProperty('--editor-max-width', noteWidth > 0 ? `${noteWidth}px` : '100%');
    container.style.setProperty('--editor-padding-top', `${paddingTop}px`);
    applyFontFamily(fontFamily);

    // Height is auto so it can grow
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100%';

    // Apply text direction to the editor element
    editorEl.setAttribute('dir', direction);

    // If editor already exists, ONLY update what's necessary, DO NOT DESTROY
    if (window.editor) {
        // Just update theme variables (already done above)

        // Update direction on the ProseMirror view DOM and editorProps so it
        // persists across view updates. CSS handles the rest via unicode-bidi.
        const currentEditorProps = window.editor.options.editorProps || {};
        window.editor.setOptions({
            editorProps: {
                ...currentEditorProps,
                attributes: {
                    ...((currentEditorProps as any).attributes || {}),
                    dir: direction,
                },
            },
        });

        // Also set dir directly on the DOM element for immediate visual update
        if (window.editor.view?.dom) {
            window.editor.view.dom.setAttribute('dir', direction);
        }

        if (currentFontFamily !== (fontFamily ?? 'system').toLowerCase()) {
            applyFontFamily(fontFamily);
        }

        // Update editable state
        if (options.editable !== undefined) {
            window.editor.setEditable(options.editable);
        }

        // Make sure scroll prop is kept
        window.editor.setOptions({
            editorProps: getEditorProps({
                direction,
                onScroll: scrollCursorIntoView
            })
        });

        // Update code block default language if changed
        const extension = window.editor.extensionManager.extensions.find((e: any) => e.name === 'codeBlock');
        if (extension) {
            currentDefaultCodeLanguage = defaultCodeLanguage;
            (window.editor as any).setOptions('codeBlock', {
                defaultLanguage: defaultCodeLanguage
            });
        }

        return;
    }

    // Ensure editor is visible
    editorEl.classList.remove('hidden');

    try {
        currentDefaultCodeLanguage = defaultCodeLanguage;
        window.editor = new Editor({
            editable: options.editable !== undefined ? options.editable : true,
            // Disable TipTap's built-in TextDirection extension entirely.
            // It's configured once at creation and can't be updated dynamically.
            // We handle direction ourselves via the DOM dir attribute + CSS.
            enableCoreExtensions: { textDirection: false } as any,
            element: editorEl,
            editorProps: getEditorProps({
                direction,
                onScroll: scrollCursorIntoView
            }),
            extensions: getExtensions({
                placeholder,
                editorOrigin,
                onMathSelected: (latex, isBlock, pos) => {
                    if (window.editor) {
                        if (typeof pos === 'number') {
                            window.editor.chain().setNodeSelection(pos).run();
                        }
                        sendMessage({ type: 'mathSelected', latex, isBlock });
                    }
                },
                onOpenBlockMenu: (_, resolve) => {
                    const res = resolve();
                    if (res) sendMessage({ type: 'openBlockMenu', ...res.message, pos: res.pos });
                },
                onOpenFileMenu: (_, resolve) => {
                    const res = resolve();
                    if (res) sendMessage({ type: 'openOpenFileMenu', ...res.message, pos: res.pos });
                },
                onOpenTableMenu: (_, resolve) => {
                    const res = resolve();
                    if (res) sendMessage({ type: 'openTableMenu', ...res.message, pos: res.pos });
                },
                onCodeBlockSelected: (_, resolve) => {
                    const res = resolve();
                    if (res) sendMessage({ type: 'codeBlockSelected', ...res.message, pos: res.pos });
                },
                onImagePasted: (data) => {
                    sendMessage({ type: 'imagePasted', ...data });
                },
                onResolveImageIds: (data) => {
                    sendMessage({ type: 'resolveImageIds', ...data });
                },
                defaultCodeLanguage,
                onSlashCommand: (data) => sendMessage({ type: 'slashCommand', ...serializeCommandData(data) }),
                onTagCommand: (data) => sendMessage({ type: 'tagCommand', ...serializeCommandData(data) }),
                onNoteLinkCommand: (data) => sendMessage({ type: 'noteLinkCommand', ...serializeCommandData(data) }),
            }),
            content: '', // Start empty to ensure view mounts before complex nodes (like fileAttachment) render

            autofocus: autofocus, // Pass directly
            onCreate: function ({ editor }) {
                // Suppress content updates during all setup mutations
                suppressContentUpdates = true;
                migrateMathStrings(editor);
                if (editor.isEmpty) {
                    if (autofocus && typeof editor.chain === 'function') {
                        editor.chain()
                            .toggleHeading({ level: 2 })
                            .insertContentAt(editor.state.doc.content.size, '<p></p>')
                            .setTextSelection(1)
                            .focus()
                            .run();
                    }
                } else if (autofocus) {
                    editor.commands.focus('end');
                }
            },
            onUpdate: function ({ editor, transaction }) {
                // `resolveImages` only injects display src values for rendering.
                // Do not persist these view-only changes back into note content.
                if (transaction?.getMeta('resolveImages')) {
                    return;
                }

                // Suppress content messages during initial editor setup
                // (font application, math migration, autofocus heading, etc.)
                if (suppressContentUpdates) {
                    return;
                }

                const { doc } = editor.state;
                const lastNode = doc.lastChild;

                // Only insert new paragraph if the last node is a "trapping" node
                const trappingTypes = ['table', 'image', 'youtube'];

                if (lastNode && trappingTypes.includes(lastNode.type.name)) {
                    editor.commands.insertContentAt(doc.content.size, '<p></p>');
                }

                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    sendMessage({ type: 'content', html: editor.getHTML() });
                }, 300);
            },
            onFocus: function () {
                sendMessage({ type: 'focus' });
            },
            onBlur: function () {
                sendMessage({ type: 'blur' });
            },
            onSelectionUpdate: function ({ editor }) {
                sendMessage({ type: 'state', state: getEditorState(editor) });
                scrollCursorIntoView();
            },
            onTransaction: function ({ editor }) {
                sendMessage({ type: 'state', state: getEditorState(editor) });
            }
        });

        applyFontFamily(fontFamily);
        // quick hack to solve notes with file attachment not loading issue
        if (content) {
            setTimeout(() => {
                if (window.editor) {
                    window.editor.commands.setContent(content);
                }
            }, 0);
        }


        if (loadingEl) loadingEl.style.display = 'none';


        // Allow content updates after setup is fully complete.
        // Use a timeout longer than the onUpdate debounce (300ms) to ensure
        // any queued updates from setup mutations are discarded.
        setTimeout(() => {
            suppressContentUpdates = false;
        }, 500);

        if (!heightObserver) {
            heightObserver = new ResizeObserver(() => {
                // Target the actual ProseMirror content div
                const target = window.editor?.view?.dom || editorEl;
                if (target) {
                    // Get the exact height of the text + a comfortable bottom padding
                    const trueContentHeight = target.scrollHeight + 80;
                    sendMessage({ type: 'heightChange', height: trueContentHeight });
                }
            });

            // ONLY observe the text elements
            if (editorEl) heightObserver.observe(editorEl);
            if (window.editor?.view?.dom) heightObserver.observe(window.editor.view.dom);
        }

    } catch (e) {
        console.error('Error during editor initialization:', e);
        showError('Init Error: ' + e);
    }
};
