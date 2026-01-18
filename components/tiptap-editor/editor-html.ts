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
        }
        
        #editor-container {
            padding: 16px;
            padding-bottom: 80px;
            min-height: 100vh;
            position: relative;
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
        }
        
        .ProseMirror h1, #display h1 { font-size: 32px; font-weight: 700; margin: 20px 0 12px 0; line-height: 1.2; }
        .ProseMirror h2, #display h2 { font-size: 26px; font-weight: 600; margin: 18px 0 10px 0; line-height: 1.3; }
        .ProseMirror h3, #display h3 { font-size: 22px; font-weight: 600; margin: 16px 0 8px 0; line-height: 1.3; }
        .ProseMirror h4, #display h4 { font-size: 18px; font-weight: 600; margin: 14px 0 6px 0; line-height: 1.4; }
        .ProseMirror h5, #display h5 { font-size: 16px; font-weight: 600; margin: 12px 0 4px 0; line-height: 1.4; }
        .ProseMirror h6, #display h6 { font-size: 14px; font-weight: 600; margin: 10px 0 4px 0; line-height: 1.4; color: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}; }
        
        .ProseMirror ul, .ProseMirror ol,
        #display ul, #display ol {
            padding-left: 24px;
            margin: 8px 0;
        }
        
        .ProseMirror li, #display li { margin: 4px 0; }
        .ProseMirror li p, #display li p { margin: 0; }
        
        .ProseMirror blockquote, #display blockquote {
            border-left: 3px solid ${accentColor};
            margin: 12px 0;
            padding-left: 16px;
            font-style: italic;
            opacity: 0.9;
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
    </style>
</head>
<body>
    <div id="editor-container">
        <div id="loading">Loading editor...</div>
        <div id="editor"></div>
        <div id="display"></div>
    </div>
    
    <div id="link-popover" class="link-popover">
        <input type="url" id="link-input" placeholder="Enter URL..." />
        <div class="link-popover-buttons">
            <button class="cancel" onclick="closeLinkPopover()">Cancel</button>
            <button class="confirm" onclick="confirmLink()">Add Link</button>
        </div>
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
                    { default: Youtube }
                ] = await Promise.all([
                    import('https://esm.sh/@tiptap/core@2.1.13'),
                    import('https://esm.sh/@tiptap/starter-kit@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-placeholder@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-underline@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-link@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-highlight@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-text-style@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-color@2.1.13'),
                    import('https://esm.sh/@tiptap/extension-youtube@2.1.13')
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
                    
                    return {
                        isBold: window.editor.isActive('bold'),
                        isItalic: window.editor.isActive('italic'),
                        isUnderline: window.editor.isActive('underline'),
                        isStrike: window.editor.isActive('strike'),
                        isCode: window.editor.isActive('code'),
                        isBulletList: window.editor.isActive('bulletList'),
                        isOrderedList: window.editor.isActive('orderedList'),
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
                        highlightColor: highlightColor,
                        textColor: textColor,
                        canUndo: window.editor.can().undo(),
                        canRedo: window.editor.can().redo(),
                    };
                }
                
                window.editor = new Editor({
                    element: editorEl,
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
                    ],
                    content: '${escapedContent}',
                    autofocus: ${autofocus} ? 'end' : false,
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
                        // Delay to check if focus moved to link popover
                        setTimeout(function() {
                            const popover = document.getElementById('link-popover');
                            if (!popover.classList.contains('visible') && !document.activeElement?.closest('#editor')) {
                                enterDisplayMode();
                            }
                        }, 150);
                        sendMessage({ type: 'blur' });
                    },
                    onSelectionUpdate: function() {
                        sendMessage({ type: 'state', state: getEditorState() });
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
                
                // Link popover functions
                window.showLinkPopover = function() {
                    const popover = document.getElementById('link-popover');
                    const input = document.getElementById('link-input');
                    const attrs = window.editor.getAttributes('link');
                    input.value = attrs.href || '';
                    popover.classList.add('visible');
                    input.focus();
                };
                
                window.closeLinkPopover = function() {
                    document.getElementById('link-popover').classList.remove('visible');
                    window.editor.commands.focus();
                };
                
                window.confirmLink = function() {
                    const url = document.getElementById('link-input').value.trim();
                    if (url) {
                        const finalUrl = url.match(/^https?:\\/\\//) ? url : 'https://' + url;
                        window.editor.chain().focus().setLink({ href: finalUrl }).run();
                    } else {
                        window.editor.chain().focus().unsetLink().run();
                    }
                    closeLinkPopover();
                };
                
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
                        toggleBlockquote: () => window.editor.chain().focus().toggleBlockquote().run(),
                        toggleCodeBlock: () => window.editor.chain().focus().toggleCodeBlock().run(),
                        toggleHeading: () => window.editor.chain().focus().toggleHeading({ level: params?.level || 1 }).run(),
                        setContent: () => { window.editor.commands.setContent(params?.content); if (!isInEditMode) enterDisplayMode(); },
                        getContent: () => sendMessage({ type: 'contentResponse', html: window.editor.getHTML() }),
                        focus: () => { enterEditMode(); window.editor.commands.focus('end'); },
                        blur: () => { window.editor.commands.blur(); enterDisplayMode(); },
                        undo: () => window.editor.chain().focus().undo().run(),
                        redo: () => window.editor.chain().focus().redo().run(),
                        showLinkPopover: () => { showLinkPopover(); return; },
                        setLink: () => params?.href && window.editor.chain().focus().setLink({ href: params.href }).run(),
                        unsetLink: () => window.editor.chain().focus().unsetLink().run(),
                        // New commands for highlight, color, and YouTube
                        setHighlight: () => window.editor.chain().focus().setHighlight({ color: params?.color }).run(),
                        unsetHighlight: () => window.editor.chain().focus().unsetHighlight().run(),
                        setColor: () => window.editor.chain().focus().setColor(params?.color).run(),
                        unsetColor: () => window.editor.chain().focus().unsetColor().run(),
                        setYoutubeVideo: () => {
                            if (params?.src) {
                                window.editor.chain().focus().setYoutubeVideo({ src: params.src }).run();
                            }
                        },
                    };
                    
                    if (commands[command]) {
                        commands[command]();
                    }
                    
                    if (command !== 'showLinkPopover' && command !== 'getContent') {
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
