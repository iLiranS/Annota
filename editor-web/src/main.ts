import { Editor } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import StarterKit from '@tiptap/starter-kit';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css'; // Better looking theme
import 'katex/dist/katex.min.css';
import { common, createLowlight } from 'lowlight';
import './styles.css';

// Initialize lowlight
// Initialize lowlight
const lowlight = createLowlight(common);

// Supported languages for the inline selector
const CODE_LANGUAGES = [
    { value: null, label: 'Auto' },
    { value: 'plaintext', label: 'Text' },
    { value: 'javascript', label: 'JS' },
    { value: 'typescript', label: 'TS' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'scss', label: 'SCSS' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' },
    { value: 'xml', label: 'XML' },
    { value: 'markdown', label: 'MD' },
    { value: 'sql', label: 'SQL' },
    { value: 'bash', label: 'Bash' },
    { value: 'dockerfile', label: 'Docker' },
];

// Custom CodeBlock with native interaction
const CustomCodeBlock = CodeBlockLowlight.extend({
    addNodeView() {
        return ({ node, editor, getPos }) => {
            // Container wrapper
            const container = document.createElement('div');
            container.className = 'code-block-wrapper';

            // The actual pre element
            const pre = document.createElement('pre');
            pre.setAttribute('data-language', node.attrs.language || 'plaintext');

            // Code element for content
            const code = document.createElement('code');
            code.className = `language-${node.attrs.language || 'plaintext'}`;
            pre.appendChild(code);

            // === HEADER BAR (language left, copy right) ===
            const header = document.createElement('div');
            header.className = 'code-block-header';

            // Language selector button (LEFT)
            const langButton = document.createElement('button');
            langButton.className = 'code-lang-select';
            langButton.type = 'button';
            const currentLang = CODE_LANGUAGES.find(l => l.value === node.attrs.language) || CODE_LANGUAGES[0];
            langButton.textContent = currentLang.label;

            // Trigger native popup
            langButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof getPos === 'function') {
                    // Force selection of the code block
                    editor.chain().focus().setNodeSelection(getPos()).run();
                    // Send message to RN to open native language selector
                    sendMessage({
                        type: 'codeBlockSelected',
                        language: node.attrs.language
                    });
                }
            };

            // Copy button (RIGHT)
            const copyButton = document.createElement('button');
            copyButton.className = 'code-copy-btn';
            copyButton.type = 'button';
            copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;

            copyButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const codeText = code.innerText || code.textContent || '';
                // Send message to RN
                sendMessage({ type: 'copyToClipboard', content: codeText });

                // Show feedback immediately
                copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>`;
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;
                    copyButton.classList.remove('copied');
                }, 2000);
            };

            // Ensure header is not treated as part of the editor content
            header.contentEditable = 'false';

            header.appendChild(langButton);
            header.appendChild(copyButton);

            container.appendChild(header);
            container.appendChild(pre);

            return {
                dom: container,
                contentDOM: code,
                ignoreMutation(mutation) {
                    if (header.contains(mutation.target as Node) || header === mutation.target) {
                        return true;
                    }
                    return false;
                },
                stopEvent: (event) => {
                    // Prevent Prosemirror from interfering with header clicks
                    if (header.contains(event.target as Node)) {
                        return true;
                    }
                    return false;
                },
                update(updatedNode) {
                    if (updatedNode.type.name !== 'codeBlock') {
                        return false;
                    }
                    const lang = updatedNode.attrs.language || 'plaintext';

                    pre.setAttribute('data-language', lang);
                    code.className = `language-${lang}`;
                    const updatedLang = CODE_LANGUAGES.find(l => l.value === lang) || CODE_LANGUAGES[0];
                    langButton.textContent = updatedLang.label;
                    return true;
                },
            };
        };
    },
}).configure({ lowlight, defaultLanguage: null });


// Add window types
declare global {
    interface Window {
        ReactNativeWebView?: {
            postMessage: (message: string) => void;
        };
        editor?: Editor;
        hljs?: typeof hljs;
        renderMathInElement?: any; // katex auto-render
        updateImage?: (attrs: any) => void;
        handleCommand?: (command: string, params?: any) => void;
        setupEditor?: (options: any) => void;
    }
}

// Elements
const loadingEl = document.getElementById('loading')!;
const editorEl = document.getElementById('editor-content')!;
const displayEl = document.getElementById('display')!;

let isInEditMode = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Communicator
function sendMessage(data: any) {
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
}

function showError(msg: string) {
    loadingEl.textContent = 'Error: ' + msg;
    loadingEl.style.color = 'red';
    sendMessage({ type: 'error', message: msg });
}

// --- Logic ---

// Since we installed 'katex', let's fix renderLatex to use it.
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render.js';

function runRenderLatex() {
    renderMathInElement(displayEl, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\\\[', right: '\\\\]', display: true },
            { left: '\\\\(', right: '\\\\)', display: false }
        ],
        throwOnError: false,
        errorColor: '#FF6B6B',
    });
}

function highlightCode() {
    displayEl.querySelectorAll('pre code').forEach((codeEl) => {
        hljs.highlightElement(codeEl as HTMLElement);

        const pre = codeEl.parentElement;
        if (!pre || pre.parentElement?.classList.contains('code-block-display')) return;

        // Get language from data attribute or class
        const lang = pre.getAttribute('data-language') ||
            (codeEl.className.match(/language-(\w+)/) || [])[1] ||
            'plaintext';
        const langLabel = CODE_LANGUAGES.find(l => l.value === lang)?.label || lang.toUpperCase();

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-display';

        // Create header
        const header = document.createElement('div');
        header.className = 'code-display-header';

        // Language badge
        const badge = document.createElement('span');
        badge.className = 'code-lang-badge';
        badge.textContent = langLabel;

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-display';
        copyBtn.type = 'button';
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;

        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const codeText = codeEl.textContent || '';
            navigator.clipboard.writeText(codeText).then(() => {
                copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>`;
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>`;
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        });

        header.appendChild(badge);
        header.appendChild(copyBtn);

        // Wrap the pre element
        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

function enterEditMode(coords?: { x: number, y: number }) {
    if (isInEditMode) return;
    isInEditMode = true;
    displayEl.classList.remove('visible');
    editorEl.classList.remove('hidden');

    // Focus immediately to preserve user gesture chain (required for mobile keyboard)
    // Use requestAnimationFrame instead of setTimeout to stay within gesture context
    requestAnimationFrame(() => {
        if (window.editor) {
            if (coords) {
                const pos = window.editor.view.posAtCoords({ left: coords.x, top: coords.y });
                if (pos) {
                    window.editor.commands.focus(pos.pos);
                    return;
                }
            }
            window.editor.commands.focus('end');
        }
    });
}

function enterDisplayMode() {
    if (!isInEditMode && displayEl.classList.contains('visible')) return;
    isInEditMode = false;

    const html = window.editor?.getHTML() || '';
    const isEmpty = !html || html === '<p></p>' || html.trim() === '';

    displayEl.innerHTML = html;
    displayEl.classList.toggle('empty', isEmpty);

    // Wrap tables
    displayEl.querySelectorAll('table').forEach(table => {
        if (!table.parentElement?.classList.contains('tableWrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'tableWrapper';
            table.parentNode?.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    runRenderLatex();
    highlightCode();

    displayEl.classList.add('visible');
    editorEl.classList.add('hidden');
}

function getEditorState() {
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
    };
}

function scrollCursorIntoView() {
    if (!window.editor) return;
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    // Use requestAnimationFrame for smoother sync with render
    requestAnimationFrame(doScrollCursorIntoView);
}

function doScrollCursorIntoView() {
    if (!window.editor) return;
    const { from } = window.editor.state.selection;
    const coords = window.editor.view.coordsAtPos(from);
    if (!coords) return;

    const viewportHeight = window.innerHeight;
    const cursorBottom = coords.bottom;
    const TOOLBAR_SAFE_OFFSET = 150; // Toolbar + Keyboard accessory + Margin
    const toolbarTop = viewportHeight - TOOLBAR_SAFE_OFFSET;

    if (cursorBottom > toolbarTop) {
        // Scroll just enough to bring it into view with margin
        const scrollAmount = cursorBottom - toolbarTop;
        window.scrollBy({ top: scrollAmount, behavior: 'auto' }); // 'auto' (instant) prevents "clumsy" smooth scroll lag
    }
}

// Extensions setup
const CustomImage = Image.extend({
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
                    editor.chain().focus().setNodeSelection(currentPos).run();

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

const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                renderHTML: attrs => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
                parseHTML: element => element.style.backgroundColor || null,
            },
        };
    },
});

const CustomTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: {
                default: null,
                renderHTML: attrs => {
                    if (!attrs.backgroundColor) return {};
                    return { style: `background-color: ${attrs.backgroundColor}` };
                },
                parseHTML: element => element.style.backgroundColor || null,
            },
        };
    },
});

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

// Setup logic
// We accept options to configure the editor initial state
window.setupEditor = function (options: any) {
    const {
        isDark = false,
        primaryColor = '#007AFF',
        content = '',
        placeholder = 'Write something...',
        autofocus = false
    } = options;

    // Set CSS variables for theme
    document.documentElement.style.setProperty('--bg-color', isDark ? '#000000' : '#FFFFFF');
    document.documentElement.style.setProperty('--text-color', isDark ? '#FFFFFF' : '#000000');
    document.documentElement.style.setProperty('--accent-color', primaryColor);
    document.documentElement.style.setProperty('--placeholder-color', isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
    document.documentElement.style.setProperty('--code-bg', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');
    document.documentElement.style.setProperty('--code-block-bg', isDark ? '#1E1E1E' : '#F5F5F5');
    document.documentElement.style.setProperty('--border-color', isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');

    // If editor already exists, ONLY update what's necessary, DO NOT DESTROY
    if (window.editor) {
        // Just update theme variables (already done above)
        // If content is empty/new, maybe set it, but usually we don't want to reset content on theme toggle
        // Only set content if explicitly asked (e.g. changing note)
        // But setupEditor might be called with same content on render
        // So we do NOT setText here to avoid wiping. Content should be set via 'setContent' command if needed.
        return;
    }

    isInEditMode = autofocus;

    try {
        window.editor = new Editor({
            element: editorEl,
            editorProps: {
                attributes: { dir: 'auto' },
                // Aggressive scrolling to keep cursor visible above keyboard/toolbar
                scrollThreshold: {
                    top: 0,
                    bottom: 200, // Trigger scroll when within 200px of bottom
                    left: 0,
                    right: 0
                },
                scrollMargin: {
                    top: 0,
                    bottom: 200, // Add 200px margin when scrolling
                    left: 0,
                    right: 0
                }
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
                Color,
                Youtube.configure({
                    width: 320,
                    height: 180,
                    HTMLAttributes: {
                        referrerPolicy: 'strict-origin-when-cross-origin' as any,
                        // Ensure it plays nice on mobile
                        playsinline: 'true',
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
                // Removed BubbleMenu as we use native popups now
            ],
            content: content,
            // We handle autofocus manually in onCreate to ensure correct placement
            autofocus: false,
            onCreate: function ({ editor }) {
                if (editor.isEmpty) {
                    // Initialize with Heading 2
                    if (typeof editor.chain === 'function') {
                        editor.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            // Ensure the spare line exists immediately
                            .insertContentAt(editor.state.doc.content.size, '<p></p>')
                            // Force focus back to the start (the heading)
                            .setTextSelection(1)
                            .run();
                    }
                } else if (autofocus) {
                    // If content exists and autofocus requested, go to end
                    editor.commands.focus('end');
                }
            },
            onUpdate: function ({ editor }) {
                // Ensure trailing paragraph
                const { doc } = editor.state;
                const lastNode = doc.lastChild;
                if (lastNode && lastNode.type.name !== 'paragraph') {
                    // Check if we are already dealing with an update to avoid loops?
                    // insertContent triggers transaction > update.
                    // But then lastNode will be paragraph, so it stops.
                    editor.commands.insertContentAt(doc.content.size, '<p></p>');
                }

                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    sendMessage({ type: 'content', html: editor.getHTML() });
                }, 300);
            },
            onFocus: function () {
                isInEditMode = true;
                displayEl.classList.remove('visible');
                editorEl.classList.remove('hidden');
                sendMessage({ type: 'focus' });
            },
            onBlur: function () {
                setTimeout(() => {
                    // Increased timeout to prevent accidental mode switch on flicker/resize
                    if (!document.activeElement?.closest('#editor-content')) {
                        enterDisplayMode();
                    }
                }, 300);
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

        editorEl.style.paddingBottom = '50vh'; // Huge padding to allow scrolling content to middle of screen

        loadingEl.style.display = 'none';

        if (!autofocus) {
            setTimeout(enterDisplayMode, 200);
        }
    } catch (e) {
        console.error('Error during editor initialization:', e);
        showError('Init Error: ' + e);
    }
};

// Command handler
window.handleCommand = function (command, params) {
    // Handle 'setOptions' command first, as it might initialize the editor
    if (command === 'setOptions') {
        if (params) {
            try {
                window.setupEditor?.(params);
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

    if (command !== 'blur' && command !== 'getContent') {
        if (!isInEditMode) enterEditMode();
    }

    const e = window.editor;
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
            if (!isInEditMode) enterDisplayMode();
            break;
        case 'getContent':
            sendMessage({ type: 'contentResponse', html: e.getHTML() });
            break;
        case 'focus':
            enterEditMode();
            e.commands.focus('end');
            break;
        case 'blur':
            e.commands.blur();
            enterDisplayMode();
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
                // Clone selection or just standard cut if works
                // Since we don't have direct clipboard access easily without permission, 
                // we will just delete it, and users can use "Copy" then "Delete" if they want, 
                // BUT "Cut" usually implies clipboard. 
                // Use modern API if available or standard execCommand
                // Since this is inside WebView, maybe document.execCommand('cut') works?
                document.execCommand('cut');
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
            if (typeof params?.position === 'number') {
                e.chain().focus().setNodeSelection(params.position).run();
            }
            break;
    }

    if (command !== 'getContent') {
        setTimeout(() => sendMessage({ type: 'state', state: getEditorState() }), 50);
    }
};


editorEl.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link && (link as HTMLAnchorElement).href) {
        e.preventDefault();
        e.stopPropagation();
        sendMessage({ type: 'openLink', href: (link as HTMLAnchorElement).href });
    }
});

// Click on display element to re-enter edit mode
displayEl.addEventListener('click', function (e) {
    // Don't intercept link clicks
    const target = e.target as HTMLElement;
    if (target.closest('a')) return;

    // Enter edit mode and focus the editor
    enterEditMode({ x: e.clientX, y: e.clientY });
});

// Notify Ready
// loadingEl.textContent = 'Connected. Waiting for config...';
sendMessage({ type: 'ready' });

// Auto-init for debugging in browser (no bridge)
if (!window.ReactNativeWebView) {
    loadingEl.textContent = 'No Bridge detected. Auto-init...';
    console.log('No WebView bridge found, auto-initializing defaults...');
    setTimeout(() => {
        window.setupEditor?.({
            content: '<p>Debug Mode (No Bridge)</p>',
            autofocus: true
        });
    }, 1000);
}
