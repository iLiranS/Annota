import { Editor } from '@tiptap/core';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { FontFamily, TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { Youtube } from '@tiptap/extension-youtube';
import { StarterKit } from '@tiptap/starter-kit';

import { Mathematics, migrateMathStrings } from '@tiptap/extension-mathematics';
import { loadingEl, sendMessage, showError } from './bridge';
import { CustomCodeBlock, CustomImage, CustomTableCell, CustomTableHeader, Details, DetailsContent, DetailsSummary, SearchExtension } from './extensions';
import { hexToRgba } from './utils';

import './types';

// DOM Elements
export const editorEl = document.getElementById('editor-content')!;


// We no longer have "display mode", so editor is always "formatting" accessible, 
// but we might want to handle ReadOnly state if requested by Native. 
// For now, assume always active.

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentFontFamily: string | null = null;
let hasAppliedFontToContent = false;

const WEB_FONT_FAMILIES: Record<string, string> = {
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    poppins: 'Poppins',
    varela: 'VarelaRound',
    'varela round': 'VarelaRound',
    'system (default)': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

function resolveFontFamily(value?: string) {
    if (!value) return WEB_FONT_FAMILIES.system;
    const key = value.toLowerCase();
    return WEB_FONT_FAMILIES[key] ?? value;
}

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

    document.documentElement.style.setProperty('--editor-font-family', resolved);
    document.body.style.fontFamily = resolved;
    editorEl.style.fontFamily = resolved;

    applyFontFamilyToContent(value);
    currentFontFamily = normalized;
}

// --- Logic ---

export function getEditorState() {
    if (!window.editor) return {};
    const e = window.editor;
    const highlightAttrs = e.getAttributes('highlight');
    const textStyleAttrs = e.getAttributes('textStyle');
    const linkAttrs = e.getAttributes('link');
    const imageAttrs = e.getAttributes('image');

    const isInTable = e.isActive('table');
    const isCodeBlock = e.isActive('codeBlock');
    const codeBlockAttrs = e.getAttributes('codeBlock');

    return {
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isUnderline: e.isActive('underline'),
        isStrike: e.isActive('strike'),
        isTaskList: e.isActive('taskList'),
        isCode: e.isActive('code'),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        canSinkListItem: e.can().sinkListItem('listItem'),
        canLiftListItem: e.can().liftListItem('listItem'),
        isBlockquote: e.isActive('blockquote'),
        isCodeBlock,
        currentCodeLanguage: isCodeBlock ? (codeBlockAttrs.language || null) : null,
        isHeading1: e.isActive('heading', { level: 1 }),
        isHeading2: e.isActive('heading', { level: 2 }),
        isHeading3: e.isActive('heading', { level: 3 }),
        isHeading4: e.isActive('heading', { level: 4 }),
        isHeading5: e.isActive('heading', { level: 5 }),
        isHeading6: e.isActive('heading', { level: 6 }),
        isLink: e.isActive('link'),
        linkHref: linkAttrs.href || null,
        highlightColor: highlightAttrs.color || null,
        textColor: textStyleAttrs.color || null,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        isInTable,
        canAddRowBefore: isInTable && e.can().addRowBefore(),
        canAddRowAfter: isInTable && e.can().addRowAfter(),
        canAddColumnBefore: isInTable && e.can().addColumnBefore(),
        canAddColumnAfter: isInTable && e.can().addColumnAfter(),
        canDeleteRow: isInTable && e.can().deleteRow(),
        canDeleteColumn: isInTable && e.can().deleteColumn(),
        canDeleteTable: isInTable && e.can().deleteTable(),
        isImage: e.isActive('image'),
        imageAttrs: e.isActive('image') ? imageAttrs : null,
        isDetails: e.isActive('details'),
        detailsBackgroundColor: e.isActive('details') ? e.getAttributes('details').backgroundColor : null,
    };
}

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

            // Get viewport dimensions
            const viewportHeight = window.innerHeight;
            const keyboardOffset = 100; // Extra padding for keyboard/toolbar area

            // Check if cursor is outside visible area
            const isAboveViewport = coords.top < 0;
            const isBelowViewport = coords.bottom > (viewportHeight - keyboardOffset);

            // Only scroll if cursor is actually outside visible area
            if (!isAboveViewport && !isBelowViewport) return;

            // Get the DOM element at cursor position
            const domAtPos = window.editor.view.domAtPos(from);
            if (!domAtPos || !domAtPos.node) return;

            const element = domAtPos.node.nodeType === Node.TEXT_NODE
                ? domAtPos.node.parentElement
                : domAtPos.node as Element;

            if (element && element instanceof HTMLElement) {
                // Use 'nearest' to minimize scroll amount - it only scrolls enough to show the element
                element.scrollIntoView({
                    block: 'end',
                    inline: 'center',
                    behavior: 'instant'
                });
            }
        } catch (e) {
            // Silently fail - don't break the editor
        }
    }, 100);
}

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
        fontFamily = 'system'
    } = options;

    // Set CSS variables for theme
    document.documentElement.style.setProperty('--bg-color', colors.background);
    document.documentElement.style.setProperty('--text-color', colors.text);
    document.documentElement.style.setProperty('--accent-color', colors.primary);
    document.documentElement.style.setProperty('--placeholder-color', isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
    document.documentElement.style.setProperty('--code-bg', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
    document.documentElement.style.setProperty('--code-block-bg', isDark ? '#1E1E1E' : '#F5F5F5');
    document.documentElement.style.setProperty('--border-color', isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
    document.documentElement.style.setProperty('--quote-bg', hexToRgba(colors.primary, 0.2));
    applyFontFamily(fontFamily);

    // Apply content padding to the body so it scrolls with the header
    document.body.style.paddingTop = `${paddingTop}px`;
    document.body.style.height = 'auto'; // Ensure body can grow with padding
    document.body.style.minHeight = '100%';

    // Apply text direction to the editor element
    editorEl.setAttribute('dir', direction);

    // If editor already exists, ONLY update what's necessary, DO NOT DESTROY
    if (window.editor) {
        // Just update theme variables (already done above)
        // Update direction properly via setOptions so it persists across re-renders
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
        if (window.editor.view?.dom) {
            window.editor.view.dom.setAttribute('dir', direction);
        }
        if (currentFontFamily !== (fontFamily ?? 'system').toLowerCase()) {
            applyFontFamily(fontFamily);
        }
        return;
    }

    // Ensure editor is visible
    editorEl.classList.remove('hidden');

    try {
        window.editor = new Editor({
            textDirection: direction,
            element: editorEl,
            editorProps: {
                attributes: { dir: direction },
                scrollThreshold: { top: 0, bottom: 80, left: 0, right: 0 },
                scrollMargin: { top: 0, bottom: 80, left: 0, right: 0 }
            },
            extensions: [
                StarterKit.configure({
                    heading: { levels: [1, 2, 3, 4, 5, 6] },
                    codeBlock: false,
                }),
                Underline,
                Placeholder.configure({ placeholder }),
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: { rel: 'noopener noreferrer' },
                }),
                Highlight.configure({ multicolor: true }),
                TextStyle,
                FontFamily.configure({
                    types: ['textStyle'],
                }),
                Color,
                Youtube.configure({
                    width: 320,
                    height: 180,
                    nocookie: true,
                    HTMLAttributes: {
                        referrerPolicy: 'no-referrer-when-downgrade' as any,
                        playsinline: 'true',
                        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    },
                }),
                CustomImage.configure({ inline: false, allowBase64: true }),
                Table.configure({ resizable: true, HTMLAttributes: { class: 'editor-table' } }),
                TableRow,
                CustomTableCell,
                CustomTableHeader,
                TaskList,
                TaskItem.configure({ nested: true }),
                CustomCodeBlock,
                // @ts-ignore - Type mismatch due to tiptap version difference between packages
                Details,
                // @ts-ignore - Type mismatch due to tiptap version difference between packages
                DetailsSummary,
                // @ts-ignore - Type mismatch due to tiptap version difference between packages
                DetailsContent,
                Mathematics.configure({
                    katexOptions: {
                        throwOnError: false,
                        output: 'html',
                    },
                    inlineOptions: {
                        onClick: (node, pos) => {
                            if (window.editor && typeof pos === 'number') {
                                window.editor.chain().setNodeSelection(pos).run();
                                sendMessage({ type: 'mathSelected', latex: node.attrs.latex, isBlock: false });
                            }
                        }
                    },
                    blockOptions: {
                        onClick: (node, pos) => {
                            if (window.editor) {
                                window.editor.chain().setNodeSelection(pos).run();
                                sendMessage({ type: 'mathSelected', latex: node.attrs.latex, isBlock: true });
                            }
                        }
                    }
                }),
                SearchExtension,
            ],
            content: content,
            autofocus: autofocus, // Pass directly
            onCreate: function ({ editor }) {
                migrateMathStrings(editor);
                if (editor.isEmpty) {
                    if (typeof editor.chain === 'function') {
                        editor.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .insertContentAt(editor.state.doc.content.size, '<p></p>')
                            .setTextSelection(1)
                            .run();
                    }
                } else if (autofocus) {
                    editor.commands.focus('end');
                }
            },
            onUpdate: function ({ editor }) {
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
            onSelectionUpdate: function () {
                sendMessage({ type: 'state', state: getEditorState() });
                scrollCursorIntoView();
            },
            onTransaction: function () {
                sendMessage({ type: 'state', state: getEditorState() });
            }
        });

        applyFontFamily(fontFamily);
        loadingEl.style.display = 'none';

    } catch (e) {
        console.error('Error during editor initialization:', e);
        showError('Init Error: ' + e);
    }
};
