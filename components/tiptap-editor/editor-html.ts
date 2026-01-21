
interface EditorHtmlOptions {
    isDark: boolean;
    primaryColor: string;
    initialContent: string;
    placeholder: string;
    autofocus: boolean;
}

/**
 * Generates the HTML for the TipTap editor running inside WebView.
 * Features:
 * - Dual mode: Edit (raw $...$) and Display (rendered LaTeX)
 * - Text formatting with colors and highlights
 * - Headings H1-H6
 * - YouTube embeds
 * - Code syntax highlighting (display mode)
 */
export function getEditorHtml(options: EditorHtmlOptions): string {
    const { isDark, primaryColor, initialContent, placeholder, autofocus } = options;

    const bgColor = isDark ? '#000000' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#000000';
    const accentColor = primaryColor || (isDark ? '#0A84FF' : '#007AFF');
    const placeholderColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    const codeBgColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
    const codeBlockBgColor = isDark ? '#1E1E1E' : '#F5F5F5';




    // Escape content for safe embedding in HTML
    const escapedContent = initialContent
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/`/g, '\\`');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    
    <!-- KaTeX for LaTeX rendering -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    
    <!-- Tippy.js CSS for Bubble Menu -->
    <link rel="stylesheet" href="https://unpkg.com/tippy.js@6/animations/scale.css">
    
    <!-- Highlight.js for code syntax highlighting -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/${isDark ? 'github-dark' : 'github'}.min.css">
    <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
    
    <style>
        * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        
        html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            background-color: ${bgColor};
            color: ${textColor};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            -webkit-text-size-adjust: 100%;
            overflow-x: hidden;
        }
        
        #editor-container {
            padding: 16px;
            padding-bottom: 80px;
            min-height: 100vh;
            position: relative;
            overflow-x: hidden;
        }
        
        #loading {
            padding: 20px;
            text-align: center;
            color: ${placeholderColor};
        }
        
        /* Edit mode - TipTap editor */
        #editor {
            outline: none;
            min-height: calc(100vh - 100px);
        }
        
        /* Display mode - rendered view with LaTeX and syntax highlighting */
        #display {
            display: none;
            min-height: calc(100vh - 100px);
            cursor: text;
            overflow-x: hidden;
        }
        
        #display.visible {
            display: block;
        }
        
        #editor.hidden {
            display: none;
        }
        
        /* Empty state placeholder for display mode */
        #display.empty::before {
            content: '${placeholder.replace(/'/g, "\\'")}';
            color: ${placeholderColor};
        }
        
        .ProseMirror, #display {
            outline: none;
            min-height: calc(100vh - 100px);
        }
        
        .ProseMirror p, #display p {
            margin: 0 0 8px 0;
            unicode-bidi: plaintext;
            text-align: start;
            min-height: 1.6em;
        }
        
        .ProseMirror h1, #display h1 { font-size: 32px; font-weight: 700; margin: 20px 0 12px 0; line-height: 1.2; unicode-bidi: plaintext; text-align: start; }
        .ProseMirror h2, #display h2 { font-size: 26px; font-weight: 600; margin: 18px 0 10px 0; line-height: 1.3; unicode-bidi: plaintext; text-align: start; }
        .ProseMirror h3, #display h3 { font-size: 22px; font-weight: 600; margin: 16px 0 8px 0; line-height: 1.3; unicode-bidi: plaintext; text-align: start; }
        .ProseMirror h4, #display h4 { font-size: 18px; font-weight: 600; margin: 14px 0 6px 0; line-height: 1.4; unicode-bidi: plaintext; text-align: start; }
        .ProseMirror h5, #display h5 { font-size: 16px; font-weight: 600; margin: 12px 0 4px 0; line-height: 1.4; unicode-bidi: plaintext; text-align: start; }
        .ProseMirror h6, #display h6 { font-size: 14px; font-weight: 600; margin: 10px 0 4px 0; line-height: 1.4; color: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}; unicode-bidi: plaintext; text-align: start; }
        
        .ProseMirror ul, .ProseMirror ol,
        #display ul, #display ol {
            padding-left: 24px;
            margin: 8px 0;
        }
        
        .ProseMirror li, #display li { margin: 4px 0; unicode-bidi: plaintext; text-align: start; }
        .ProseMirror li p, #display li p { margin: 0; unicode-bidi: plaintext; text-align: start; }
        
        .ProseMirror blockquote, #display blockquote {
            border-left: 3px solid ${accentColor};
            margin: 12px 0;
            padding-left: 16px;
            font-style: italic;
            opacity: 0.9;
            background-color: ${accentColor + "40"};
            border-top-right-radius: 4px;
            border-bottom-right-radius: 4px;
        }
        
        .ProseMirror code, #display code {
            background-color: ${codeBgColor};
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
            font-size: 14px;
        }
        
        .ProseMirror pre, #display pre {
            background-color: ${codeBlockBgColor};
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 12px 0;
            font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .ProseMirror pre code, #display pre code {
            background: none;
            padding: 0;
            font-size: inherit;
        }
        
        /* Highlight.js overrides for display mode */
        #display pre code.hljs {
            background: transparent;
            padding: 0;
        }
        
        .ProseMirror hr, #display hr {
            border: none;
            border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'};
            margin: 16px 0;
        }
        
        .ProseMirror a, #display a {
            color: ${accentColor};
            text-decoration: underline;
            cursor: pointer;
        }
        
        /* Highlight/mark styling */
        .ProseMirror mark, #display mark {
            border-radius: 2px;
            padding: 0 2px;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            color: ${placeholderColor};
            pointer-events: none;
            float: left;
            height: 0;
        }
        
        .ProseMirror-focused { outline: none; }
        
        /* KaTeX display styles */
        .katex-display {
            margin: 16px 0;
            overflow-x: auto;
            overflow-y: hidden;
        }
        
        /* YouTube embed styles */
        .ProseMirror div[data-youtube-video], #display div[data-youtube-video] {
            margin: 16px 0;
            width: 100%;
            display: flex;
            justify-content: center;
        }
        
        .ProseMirror iframe, #display iframe {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 16 / 9;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        /* Image styles */
        .ProseMirror img, #display img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 8px 0;
        }
        
        .ProseMirror img.ProseMirror-selectednode {
            outline: 3px solid ${accentColor};
            border-radius: 8px;
        }

        /* Image Alignment Classes */
        .ProseMirror img.img-center, #display img.img-center { margin: 8px auto; display: block; }
        .ProseMirror img.img-left, #display img.img-left { margin: 8px auto 8px 0; display: block; }
        .ProseMirror img.img-right, #display img.img-right { margin: 8px 0 8px auto; display: block; }
        
        /* Link input popover styles */
        .link-popover {
            position: fixed;
            bottom: 60px;
            left: 16px;
            right: 16px;
            background: ${isDark ? '#2C2C2E' : '#FFFFFF'};
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
        }
        
        .link-popover.visible { display: block; }
        
        .link-popover input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'};
            border-radius: 8px;
            background: ${isDark ? '#1C1C1E' : '#F2F2F7'};
            color: ${textColor};
            font-size: 16px;
            outline: none;
            margin-bottom: 8px;
        }
        
        .link-popover-buttons {
            display: flex;
            gap: 8px;
        }
        
        .link-popover button {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
        }
        
        .link-popover button.cancel {
            background: ${isDark ? '#3A3A3C' : '#E5E5EA'};
            color: ${textColor};
        }
        
        .link-popover button.confirm {
            background: ${accentColor};
            color: white;
        }
        
        /* Table Styles */
        /* Wrapper to enable horizontal scroll for tables */
        .ProseMirror .tableWrapper, #display .tableWrapper {
            overflow-x: auto;
            margin: 16px 0;
            -webkit-overflow-scrolling: touch;
        }
        
        .ProseMirror table, #display table {
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            table-layout: auto;
        }
        
        .ProseMirror td, .ProseMirror th,
        #display td, #display th {
            min-width: 80px;
            padding: 8px 12px;
            border: 1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'};
            text-align: left;
            vertical-align: top;
            position: relative;
            word-wrap: break-word;
        }
        
        .ProseMirror th, #display th {
            background-color: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'};
            font-weight: 600;
        }
        
        .ProseMirror .selectedCell {
            background-color: ${accentColor}22;
        }
        
        .ProseMirror .column-resize-handle {
            position: absolute;
            right: -2px;
            top: 0;
            bottom: -2px;
            width: 4px;
            background-color: ${accentColor};
            pointer-events: none;
        }
        
        .ProseMirror.resize-cursor {
            cursor: col-resize;
        }
    </style>
    
    <style>
        /* Bubble Menu for Images */
        .bubble-menu {
            display: flex;
            align-items: center;
            background-color: ${isDark ? '#2C2C2E' : '#FFFFFF'};
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
            gap: 8px;
            min-width: 280px;
        }

        .bubble-menu button {
            border: none;
            background: none;
            color: ${textColor};
            padding: 6px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
        }

        .bubble-menu button:hover {
            background-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
        }

        .bubble-menu button.active {
            background-color: ${accentColor};
            color: white;
        }

        .bubble-menu .separator {
            width: 1px;
            height: 20px;
            background-color: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
            margin: 0 4px;
        }
        
        .bubble-menu svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        
        .bubble-menu span {
            font-size: 13px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div id="editor-container">
        <div id="loading">Loading editor...</div>
        <div id="editor"></div>
        <div id="display" dir="auto"></div>
    </div>
    
    <!-- Link popover removed - now using React Native popup -->
    
    <div id="bubble-menu" class="bubble-menu" style="visibility: hidden;">
        <!-- Alignment -->
        <button id="btn-align-left" onclick="updateImage({ align: 'left' })">
            <svg viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zm0-4h12v-2H3v2zm0-4h18v-2H3v2zm0-4h12V7H3v2zm0-6v2h18V3H3z"/></svg>
        </button>
        <button id="btn-align-center" onclick="updateImage({ align: 'center' })">
            <svg viewBox="0 0 24 24"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>
        </button>
        <button id="btn-align-right" onclick="updateImage({ align: 'right' })">
            <svg viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zm-6-6v2h18V3H3z"/></svg>
        </button>
        
        <div class="separator"></div>
        
        <!-- Width -->
        <button id="btn-width-full" onclick="updateImage({ width: '100%' })">
            <span>100%</span>
        </button>
        <button id="btn-width-med" onclick="updateImage({ width: '75%' })">
            <span>75%</span>
        </button>
        <button id="btn-width-small" onclick="updateImage({ width: '50%' })">
            <span>50%</span>
        </button>
    </div>
    
    <script type="module">
        const loadingEl = document.getElementById('loading');
        const editorEl = document.getElementById('editor');
        const displayEl = document.getElementById('display');
        const containerEl = document.getElementById('editor-container');
        
        let isInEditMode = ${autofocus};
        
        function sendMessage(data) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(data));
            }
        }
        
        function showError(msg) {
            loadingEl.textContent = 'Error: ' + msg;
            loadingEl.style.color = 'red';
            sendMessage({ type: 'error', message: msg });
        }
        
        // Render LaTeX in the display element
        function renderLatex() {
            if (window.renderMathInElement) {
                try {
                    window.renderMathInElement(displayEl, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\\\[', right: '\\\\]', display: true },
                            { left: '\\\\(', right: '\\\\)', display: false }
                        ],
                        throwOnError: false,
                        errorColor: '#FF6B6B',
                    });
                } catch (e) {
                    console.log('LaTeX render error:', e);
                }
            }
        }
        
        // Apply syntax highlighting to code blocks
        function highlightCode() {
            if (window.hljs) {
                displayEl.querySelectorAll('pre code').forEach((block) => {
                    // Auto-detect language
                    window.hljs.highlightElement(block);
                });
            }
        }
        
        // Switch to edit mode (hide display, show editor)
        function enterEditMode() {
            if (isInEditMode) return;
            isInEditMode = true;
            displayEl.classList.remove('visible');
            editorEl.classList.remove('hidden');
            window.editor?.commands.focus('end');
        }
        
        // Switch to display mode (show rendered content with LaTeX and code highlighting)
        function enterDisplayMode() {
            if (!isInEditMode && displayEl.classList.contains('visible')) return;
            isInEditMode = false;
            
            // Get the current HTML content
            const html = window.editor?.getHTML() || '';
            
            // Check if content is empty
            const isEmpty = !html || html === '<p></p>' || html.trim() === '';
            
            // Copy content to display element
            displayEl.innerHTML = html;
            displayEl.classList.toggle('empty', isEmpty);
            
            // Wrap tables in scrollable containers for display mode
            displayEl.querySelectorAll('table').forEach(table => {
                if (!table.parentElement?.classList.contains('tableWrapper')) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'tableWrapper';
                    table.parentNode.insertBefore(wrapper, table);
                    wrapper.appendChild(table);
                }
            });
            
            // Render LaTeX and highlight code
            renderLatex();
            highlightCode();
            
            // Show display, hide editor
            displayEl.classList.add('visible');
            editorEl.classList.add('hidden');
        }
        
        async function initEditor() {
            try {
                loadingEl.textContent = 'Loading TipTap...';
                
                // Import TipTap modules including new extensions
                const [
                    { Editor },
                    { default: StarterKit },
                    { default: Placeholder },
                    { default: Underline },
                    { default: Link },
                    { default: Highlight },
                    { default: TextStyle },
                    { default: Color },
                    { default: Youtube },
                    { default: Image },
                    { default: BubbleMenu },
                    { default: Table },
                    { default: TableRow },
                    { default: TableCell },
                    { default: TableHeader }
                ] = await Promise.all([
                    import('https://esm.sh/@tiptap/core@2.1.13'),
                    import('https://esm.sh/@tiptap/starter-kit@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-placeholder@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-underline@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-link@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-highlight@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-text-style@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-color@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-youtube@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-image@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-bubble-menu@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-table@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-table-row@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-table-cell@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-table-header@2.1.13')
                ]);
                
                loadingEl.style.display = 'none';
                
                let debounceTimer = null;
                
                function getCurrentHeadingLevel() {
                    for (let level = 1; level <= 6; level++) {
                        if (window.editor.isActive('heading', { level })) {
                            return level;
                        }
                    }
                    return null;
                }
                
                function getEditorState() {
                    if (!window.editor) return {};
                    
                    // Get highlight color
                    const highlightAttrs = window.editor.getAttributes('highlight');
                    const highlightColor = highlightAttrs.color || null;
                    
                    // Get text color
                    const textStyleAttrs = window.editor.getAttributes('textStyle');
                    const textColor = textStyleAttrs.color || null;
                    
                    // Get link href
                    const linkAttrs = window.editor.getAttributes('link');
                    const linkHref = linkAttrs.href || null;

                    // Update Bubble Menu State
                    if (window.editor.isActive('image')) {
                        const attrs = window.editor.getAttributes('image');
                        const align = attrs.align || 'center';
                        const width = attrs.width || '100%';
                        
                        document.querySelectorAll('.bubble-menu button').forEach(b => b.classList.remove('active'));
                        if (document.getElementById('btn-align-' + align)) 
                            document.getElementById('btn-align-' + align).classList.add('active');
                        
                        // Width logic approximation
                        if (width === '100%') document.getElementById('btn-width-full')?.classList.add('active');
                        else if (width === '75%') document.getElementById('btn-width-med')?.classList.add('active');
                        else if (width === '50%') document.getElementById('btn-width-small')?.classList.add('active');
                    }
                    
                    // Table state
                    const isInTable = window.editor.isActive('table');
                    
                    return {
                        isBold: window.editor.isActive('bold'),
                        isItalic: window.editor.isActive('italic'),
                        isUnderline: window.editor.isActive('underline'),
                        isStrike: window.editor.isActive('strike'),
                        isCode: window.editor.isActive('code'),
                        isBulletList: window.editor.isActive('bulletList'),
                        isOrderedList: window.editor.isActive('orderedList'),
                        canSinkListItem: window.editor.can().sinkListItem('listItem'),
                        canLiftListItem: window.editor.can().liftListItem('listItem'),
                        isBlockquote: window.editor.isActive('blockquote'),
                        isCodeBlock: window.editor.isActive('codeBlock'),
                        isHeading1: window.editor.isActive('heading', { level: 1 }),
                        isHeading2: window.editor.isActive('heading', { level: 2 }),
                        isHeading3: window.editor.isActive('heading', { level: 3 }),
                        isHeading4: window.editor.isActive('heading', { level: 4 }),
                        isHeading5: window.editor.isActive('heading', { level: 5 }),
                        isHeading6: window.editor.isActive('heading', { level: 6 }),
                        currentHeadingLevel: getCurrentHeadingLevel(),
                        isLink: window.editor.isActive('link'),
                        linkHref: linkHref,
                        highlightColor: highlightColor,
                        textColor: textColor,
                        canUndo: window.editor.can().undo(),
                        canRedo: window.editor.can().redo(),
                        // Table state
                        isInTable: isInTable,
                        canAddRowBefore: isInTable && window.editor.can().addRowBefore(),
                        canAddRowAfter: isInTable && window.editor.can().addRowAfter(),
                        canAddColumnBefore: isInTable && window.editor.can().addColumnBefore(),
                        canAddColumnAfter: isInTable && window.editor.can().addColumnAfter(),
                        canDeleteRow: isInTable && window.editor.can().deleteRow(),
                        canDeleteColumn: isInTable && window.editor.can().deleteColumn(),
                        canDeleteTable: isInTable && window.editor.can().deleteTable(),
                    };
                }

                const CustomImage = Image.extend({
                    addAttributes() {
                        return {
                            ...this.parent?.(),
                            width: {
                                default: '100%',
                                renderHTML: attributes => ({
                                    style: \`width: \${attributes.width}; height: auto;\`
                                }),
                                parseHTML: element => element.style.width || element.getAttribute('width'),
                            },
                            align: {
                                default: 'center',
                                renderHTML: attributes => ({
                                    class: \`img-\${attributes.align}\`
                                }),
                                parseHTML: element => {
                                    if (element.classList.contains('img-left')) return 'left';
                                    if (element.classList.contains('img-right')) return 'right';
                                    return 'center';
                                },
                            }
                        }
                    }
                });

                // Global function to update image attributes
                window.updateImage = function(attrs) {
                    if (window.editor) {
                        window.editor.chain().focus().updateAttributes('image', attrs).run();
                    }
                };
                
                window.editor = new Editor({
                    element: editorEl,
                    editorProps: {
                        attributes: {
                            dir: 'auto',
                        },
                    },
                    extensions: [
                        StarterKit.configure({
                            heading: { levels: [1, 2, 3, 4, 5, 6] },
                        }),
                        Underline,
                        Placeholder.configure({
                            placeholder: '${placeholder.replace(/'/g, "\\'")}',
                        }),
                        Link.configure({
                            openOnClick: false,
                            HTMLAttributes: { rel: 'noopener noreferrer' },
                        }),
                        Highlight.configure({
                            multicolor: true,
                        }),
                        TextStyle,
                        Color,
                        Youtube.configure({
                            width: 320,
                            height: 180,
                           
                            HTMLAttributes: {
                                referrerpolicy: 'strict-origin-when-cross-origin',
                            },
                        }),
                        CustomImage.configure({
                            inline: false,
                            allowBase64: true,
                        }),
                        Table.configure({
                            resizable: true,
                            HTMLAttributes: {
                                class: 'editor-table',
                            },
                        }),
                        TableRow,
                        TableCell,
                        TableHeader,
                        BubbleMenu.configure({
                            element: document.getElementById('bubble-menu'),
                            tippyOptions: {
                                duration: 100,
                                placement: 'bottom',
                                animation: 'fade',
                                zIndex: 999,
                            },
                            shouldShow: ({ editor }) => {
                                return editor.isActive('image');
                            },
                        }),
                    ],
                    content: '${escapedContent}',
                    autofocus: ${autofocus} ? 'end' : false,
                    onCreate: function({ editor }) {
                        if (editor.isEmpty) {
                            editor.chain().focus().toggleHeading({ level: 2 }).run();
                        }
                    },
                    onUpdate: function({ editor }) {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(function() {
                            sendMessage({ type: 'content', html: editor.getHTML() });
                        }, 300);
                    },
                    onFocus: function() {
                        isInEditMode = true;
                        displayEl.classList.remove('visible');
                        editorEl.classList.remove('hidden');
                        sendMessage({ type: 'focus' });
                    },
                    onBlur: function() {
                        // Small delay before checking if we should enter display mode
                        setTimeout(function() {
                            if (!document.activeElement?.closest('#editor')) {
                                enterDisplayMode();
                            }
                        }, 150);
                        sendMessage({ type: 'blur' });
                    },
                    onSelectionUpdate: function() {
                        sendMessage({ type: 'state', state: getEditorState() });
                        // Auto-scroll cursor into view, accounting for toolbar height
                        scrollCursorIntoView();
                    },
                    onTransaction: function() {
                        sendMessage({ type: 'state', state: getEditorState() });
                    }
                });
                
                // Click anywhere in the container to edit
                containerEl.addEventListener('click', function(e) {
                    // Don't trigger if clicking on display links
                    const link = e.target.closest('a');
                    if (link && link.href && displayEl.contains(link)) {
                        e.preventDefault();
                        e.stopPropagation();
                        sendMessage({ type: 'openLink', href: link.href });
                        return;
                    }
                    
                    // Enter edit mode and focus
                    if (!isInEditMode || !editorEl.contains(e.target)) {
                        enterEditMode();
                    }
                });
                
                // Handle link clicks in editor
                editorEl.addEventListener('click', function(e) {
                    const link = e.target.closest('a');
                    if (link && link.href) {
                        e.preventDefault();
                        e.stopPropagation();
                        sendMessage({ type: 'openLink', href: link.href });
                    }
                });
                
                // Auto-scroll to keep cursor visible above toolbar
                // Toolbar + extra safe margin (toolbar ~50px, rounded container, safe area)
                const TOOLBAR_SAFE_OFFSET = 120;
                let scrollDebounceTimer = null;
                
                function scrollCursorIntoView() {
                    if (!window.editor) return;
                    
                    // Debounce to prevent jittery scrolling
                    clearTimeout(scrollDebounceTimer);
                    scrollDebounceTimer = setTimeout(function() {
                        doScrollCursorIntoView();
                    }, 50);
                }
                
                function doScrollCursorIntoView() {
                    if (!window.editor) return;
                    
                    // Get the current selection
                    const { from } = window.editor.state.selection;
                    const coords = window.editor.view.coordsAtPos(from);
                    
                    if (!coords) return;
                    
                    const viewportHeight = window.innerHeight;
                    const cursorBottom = coords.bottom;
                    
                    // Calculate where the toolbar starts (from the bottom of viewport)
                    const toolbarTop = viewportHeight - TOOLBAR_SAFE_OFFSET;
                    
                    // Only scroll down if cursor is behind the toolbar
                    // Use absolute position in viewport (not accounting for scrollY)
                    if (cursorBottom > toolbarTop) {
                        const scrollAmount = cursorBottom - toolbarTop + 30; // Extra 30px padding
                        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    }
                    
                    // Note: We intentionally don't scroll up automatically
                    // as that causes jittery behavior when typing at the bottom
                }
                
                // Command handler
                window.handleCommand = function(command, params) {
                    if (!window.editor) return;
                    
                    // Ensure we're in edit mode for editing commands
                    if (command !== 'blur' && command !== 'getContent') {
                        if (!isInEditMode) {
                            isInEditMode = true;
                            displayEl.classList.remove('visible');
                            editorEl.classList.remove('hidden');
                        }
                    }
                    
                    const commands = {
                        toggleBold: () => window.editor.chain().focus().toggleBold().run(),
                        toggleItalic: () => window.editor.chain().focus().toggleItalic().run(),
                        toggleUnderline: () => window.editor.chain().focus().toggleUnderline().run(),
                        toggleStrike: () => window.editor.chain().focus().toggleStrike().run(),
                        toggleCode: () => window.editor.chain().focus().toggleCode().run(),
                        toggleBulletList: () => window.editor.chain().focus().toggleBulletList().run(),
                        toggleOrderedList: () => window.editor.chain().focus().toggleOrderedList().run(),
                        sinkListItem: () => window.editor.chain().focus().sinkListItem('listItem').run(),
                        liftListItem: () => window.editor.chain().focus().liftListItem('listItem').run(),
                        toggleBlockquote: () => window.editor.chain().focus().toggleBlockquote().run(),
                        toggleCodeBlock: () => window.editor.chain().focus().toggleCodeBlock().run(),
                        toggleHeading: () => window.editor.chain().focus().toggleHeading({ level: params?.level || 1 }).run(),
                        setContent: () => { window.editor.commands.setContent(params?.content); if (!isInEditMode) enterDisplayMode(); },
                        getContent: () => sendMessage({ type: 'contentResponse', html: window.editor.getHTML() }),
                        focus: () => { enterEditMode(); window.editor.commands.focus('end'); },
                        blur: () => { window.editor.commands.blur(); enterDisplayMode(); },
                        undo: () => window.editor.chain().focus().undo().run(),
                        redo: () => window.editor.chain().focus().redo().run(),
                        setLink: () => params?.href && window.editor.chain().focus().setLink({ href: params.href }).run(),
                        unsetLink: () => window.editor.chain().focus().unsetLink().run(),
                        // Commands for highlight, color, YouTube, and Image
                        setHighlight: () => window.editor.chain().focus().setHighlight({ color: params?.color }).run(),
                        unsetHighlight: () => window.editor.chain().focus().unsetHighlight().run(),
                        setColor: () => window.editor.chain().focus().setColor(params?.color).run(),
                        unsetColor: () => window.editor.chain().focus().unsetColor().run(),
                        setYoutubeVideo: () => {
                            if (params?.src) {
                                window.editor.chain().focus().setYoutubeVideo({ src: params.src }).run();
                            }
                        },
                        setImage: () => {
                            if (params?.src) {
                                window.editor.chain().focus().setImage({ src: params.src }).run();
                            }
                        },
                        // Table commands
                        insertTable: () => {
                            const rows = params?.rows || 3;
                            const cols = params?.cols || 3;
                            const withHeaderRow = params?.withHeaderRow !== false;
                            window.editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();
                        },
                        addRowBefore: () => window.editor.chain().focus().addRowBefore().run(),
                        addRowAfter: () => window.editor.chain().focus().addRowAfter().run(),
                        addColumnBefore: () => window.editor.chain().focus().addColumnBefore().run(),
                        addColumnAfter: () => window.editor.chain().focus().addColumnAfter().run(),
                        deleteRow: () => window.editor.chain().focus().deleteRow().run(),
                        deleteColumn: () => window.editor.chain().focus().deleteColumn().run(),
                        deleteTable: () => window.editor.chain().focus().deleteTable().run(),
                    };
                    
                    if (commands[command]) {
                        commands[command]();
                    }
                    
                    if (command !== 'getContent') {
                        setTimeout(() => sendMessage({ type: 'state', state: getEditorState() }), 50);
                    }
                };
                
                sendMessage({ type: 'ready' });
                
                // Start in display mode unless autofocus
                if (!${autofocus}) {
                    // Small delay to ensure editor is ready
                    setTimeout(function() {
                        enterDisplayMode();
                    }, 200);
                }
                
            } catch (error) {
                showError(error.message || 'Failed to load editor');
            }
        }
        
        initEditor();
    </script>
</body>
</html>
`;
}
