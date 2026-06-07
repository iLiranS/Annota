import { ExportAdapter, ExportOptions } from './types';
import { SHORT_TO_HEX } from '../extensions/marks';
import { GENERATED_CORE_STYLES } from './generated-styles';
import { ensureDOMPolyfill } from './domPolyfill';

const SHORT_TO_RGBA: Record<string, string> = {
    yw: 'rgba(255, 224, 102, 0.3)',
    or: 'rgba(255, 169, 77, 0.3)',
    re: 'rgba(255, 107, 107, 0.3)',
    pi: 'rgba(247, 131, 172, 0.3)',
    in: 'rgba(129, 140, 248, 0.3)',
    bl: 'rgba(116, 192, 252, 0.3)',
    te: 'rgba(32, 201, 151, 0.3)',
    gr: 'rgba(81, 207, 102, 0.3)',
    gy: 'rgba(114, 114, 114, 0.3)',
    br: 'rgba(160, 120, 85, 0.3)',
};

export async function preprocessHtmlForPrint(
    html: string,
    adapter?: ExportAdapter,
    options?: ExportOptions
): Promise<string> {
    await ensureDOMPolyfill();

    const g = globalThis as Record<string, unknown>;
    const activeDoc: any =
        typeof document !== 'undefined' ? document : (g['document'] ?? null);

    if (!activeDoc) return html;

    const DOMParserCtor: any =
        typeof DOMParser !== 'undefined' ? DOMParser : (g['DOMParser'] as any);

    const doc: any = new DOMParserCtor().parseFromString(html, 'text/html');

    // 0a. Formatter / Migrator for Flashcard Blocks inside PDF/Print ───
    doc.querySelectorAll('div[data-type="flashcardBlock"]').forEach((node: any) => {
        const title = node.getAttribute('data-title') || 'Flashcards';
        try {
            const cards = JSON.parse(node.getAttribute('data-c') || '[]');
            const rows = cards.map(([q, a]: [string, string]) => 
                `<tr><td class="flashcard-cell-question">${q}</td><td class="flashcard-cell-answer">${a}</td></tr>`
            ).join('');
            
            node.innerHTML = `
                <h3 class="flashcard-export-title">${title}</h3>
                <table class="flashcard-export-table">
                    <thead><tr><th>Questions</th><th>Answers</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        } catch (e) {
            console.warn('ExportService: Failed to format flashcard block for print', e);
        }
    });

    // 0. Promote highlight and text color classes to inline styles for print compatibility ───
    doc.querySelectorAll('[class*="tc-"], [class*="hl-"]').forEach((node: any) => {
        const el = node as HTMLElement;
        const classes = Array.from(el.classList);
        for (const className of classes) {
            if (className.startsWith('tc-')) {
                const short = className.slice(3);
                const hex = SHORT_TO_HEX[short];
                if (hex) {
                    el.style.color = hex;
                }
            } else if (className.startsWith('hl-')) {
                const short = className.slice(3);
                const rgba = SHORT_TO_RGBA[short];
                if (rgba) {
                    el.style.backgroundColor = rgba;
                    el.style.color = 'inherit';
                }
            }
        }
    });

    // 1. Handle Mermaid diagrams ───────────────────────────────────────────
    const hasBrowserDOM = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function';
    const mermaidNodes: any[] = Array.from(
        doc.querySelectorAll('[data-type="mermaid"]'),
    );
    if (mermaidNodes.length > 0) {
        if (hasBrowserDOM) {
            try {
                const mermaid = (await import('mermaid')).default;
                mermaid.parseError = () => {};
                mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', suppressErrorRendering: true });

                for (let i = 0; i < mermaidNodes.length; i++) {
                    const node = mermaidNodes[i];
                    const code = node.getAttribute('code') ?? '';
                    if (!code.trim()) continue;
                    const { svg } = await mermaid.render(`mermaid-export-${i}`, code);
                    node.innerHTML = svg;
                    node.style.display = 'flex';
                    node.style.justifyContent = 'center';
                    node.style.margin = '1.5em 0';
                }
            } catch (err) {
                console.error('ExportService: Mermaid pre-render failed', err);
            }
        } else {
            // Mobile PDF: Convert code to an image URL via Mermaid Ink API
            for (const node of mermaidNodes) {
                const code = node.getAttribute('code') ?? '';
                if (!code.trim()) continue;

                try {
                    const utf8 = unescape(encodeURIComponent(code));
                    const b64 = typeof btoa !== 'undefined' ? btoa(utf8) : (globalThis as any).Buffer.from(utf8).toString('base64');
                    node.innerHTML = `<img src="https://mermaid.ink/svg/${b64}" style="max-width: 100%; height: auto; margin: 1.5em auto; display: block;" />`;
                    node.removeAttribute('code');
                } catch (e) {
                    console.error('ExportService: Mermaid base64 encoding failed on mobile', e);
                }
            }
        }
    }
    // 1b. Hydrate task items for print ──────────────────────────────────────
    const taskLists: any[] = Array.from(doc.querySelectorAll('ul[data-type="taskList"]'));
    for (const ul of taskLists) {
        const items: any[] = Array.from(ul.querySelectorAll(':scope > li[data-checked]'));
        for (const li of items) {
            if (li.querySelector(':scope > label')) continue;

            const isChecked = li.getAttribute('data-checked') === 'true';

            // Create checkbox label
            const label = doc.createElement('label');
            label.setAttribute('contenteditable', 'false');
            const input = doc.createElement('input');
            input.setAttribute('type', 'checkbox');
            if (isChecked) input.setAttribute('checked', 'checked');
            const span = doc.createElement('span');
            label.appendChild(input);
            label.appendChild(span);

            // Wrap existing children in a <div>
            const contentDiv = doc.createElement('div');
            while (li.firstChild) {
                contentDiv.appendChild(li.firstChild);
            }

            li.appendChild(label);
            li.appendChild(contentDiv);
        }
    }

    // 2. Promote background colours, fix Image/Table collapsing, and setup auto-direction ─────────
    doc.querySelectorAll('[data-type="details"],[data-type="detailsSummary"],[data-type="detailsContent"],td,th,mark,[style*="background"],img,table,ul,ol,blockquote')
        .forEach((el: HTMLElement) => {
            // Auto-direction for RTL support
            if (!el.hasAttribute('dir')) {
                el.setAttribute('dir', 'auto');
            }

            // Fix Backgrounds
            const color = el.getAttribute('data-background-color') ?? el.style?.backgroundColor ?? null;
            if (color) el.style.backgroundColor = color;

            // Fix Tables (Ensure they take full width)
            if (el.tagName.toLowerCase() === 'table') {
                el.style.width = '100%';
                el.removeAttribute('width');
            }

            // Fix Images (Prevent 0px height collapse in PDF print engines)
            if (el.tagName.toLowerCase() === 'img') {
                el.style.display = 'block';
                el.style.maxWidth = '100%';
                el.style.height = 'auto';
                el.style.margin = '1em auto';
                el.removeAttribute('draggable');
            }
        });

    // 3. Inline Images to Base64 ───────────────────────────────────────────
    const imgNodes = Array.from(doc.querySelectorAll('img'));
    for (const img of imgNodes) {
        const el = img as HTMLElement;
        let src = el.getAttribute('src');
        const imageId = el.getAttribute('data-image-id');

        if ((!src || src === "") && imageId && adapter?.resolveImage) {
            try {
                const resolved = await adapter.resolveImage(imageId);
                if (resolved) {
                    el.setAttribute('src', resolved);
                    src = resolved;
                }
            } catch (err) {
                console.warn(`ExportService: Failed to resolve data-image-id ${imageId}`, err);
            }
        }

        if (!src || src.startsWith('data:')) continue;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const response = await fetch(src, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();

            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new (globalThis as any).FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            el.setAttribute('src', base64);
            el.setAttribute('loading', 'eager');
            el.setAttribute('decoding', 'sync');

            el.style.maxWidth = '100%';
            el.style.height = 'auto';
            el.style.display = 'block';
            el.style.margin = '1em auto';
        } catch (err) {
            console.warn(`ExportService: Failed to inline image ${src}`, err);
        }
    }

    // 4. Handle LaTeX ─────────────────────────────────────────────────────
    const mathNodes = Array.from(doc.querySelectorAll('[data-type="inlineMath"], [data-type="mathBlock"], [data-latex], .Tiptap-mathematics-render, .katex, [data-formula]'));
    if (mathNodes.length > 0) {
        try {
            const katex = (await import('katex')).default;
            for (const node of mathNodes) {
                const el = node as HTMLElement;
                const formula = el.getAttribute('data-latex') || el.getAttribute('data-formula') || el.textContent || '';

                if (formula) {
                    try {
                        const isBlock = el.tagName === 'DIV' || el.getAttribute('data-type') === 'mathBlock' || el.getAttribute('data-display') === 'true';
                        el.innerHTML = katex.renderToString(formula, {
                            throwOnError: false,
                            displayMode: isBlock
                        });
                    } catch (e) {
                        console.error('KaTeX individual node render failed', e);
                        el.textContent = `$$${formula}$$`;
                    }
                }
            }
        } catch (err) {
            console.warn('ExportService: KaTeX pre-render failed', err);
        }
    }

    // 5. Code Highlighting ─────────────────────────────────────────────
    const codeNodes = Array.from(doc.querySelectorAll('pre code'));
    if (codeNodes.length > 0) {
        try {
            const hljs = (await import('highlight.js')).default;
            for (const node of codeNodes) {
                const el = node as HTMLElement;
                const classMatch = el.className.match(/language-([a-zA-Z0-9_+\-#]+)/);
                const parentLang = el.parentElement?.getAttribute('data-language');
                let lang = classMatch ? classMatch[1] : (parentLang || 'plaintext');
                if (lang === 'null' || lang === 'undefined' || lang === 'auto') {
                    lang = 'plaintext';
                }

                if (el.querySelector('span')) continue;

                const code = el.textContent || '';
                if (code) {
                    try {
                        const result = hljs.getLanguage(lang)
                            ? hljs.highlight(code, { language: lang }).value
                            : hljs.highlightAuto(code).value;
                        el.innerHTML = result;
                        el.classList.add('hljs');
                    } catch (err) {
                        console.warn(`ExportService: Syntax highlighting failed for language ${lang}`, err);
                    }
                }
            }
        } catch (err) {
            console.warn('ExportService: highlight.js failed to load dynamically', err);
        }
    }

    // 6. Handle code block line numbers ──────────────────────────────────
    if (options?.numberedLines !== false) {
        doc.querySelectorAll('pre').forEach((pre: any) => {
            let isInsideMermaid = false;
            let current = pre;
            while (current) {
                if (current.getAttribute?.('data-type') === 'mermaid' || current.classList?.contains('mermaid-block')) {
                    isInsideMermaid = true;
                    break;
                }
                current = current.parentNode;
            }
            
            if (isInsideMermaid || pre.parentElement?.classList?.contains('code-block-wrapper')) {
                return;
            }

            const codeEl = pre.querySelector('code');
            const text = codeEl?.textContent || pre.textContent || '';
            
            const lines = text.replace(/\n$/, '').split('\n');
            const lineCount = lines.length;

            const wrapper = doc.createElement('div');
            wrapper.className = 'code-block-wrapper';

            const gutter = doc.createElement('div');
            gutter.className = 'code-gutter';
            gutter.setAttribute('contenteditable', 'false');

            for (let i = 1; i <= lineCount; i++) {
                const span = doc.createElement('span');
                span.textContent = String(i);
                gutter.appendChild(span);
            }

            pre.parentNode?.insertBefore(wrapper, pre);
            wrapper.appendChild(gutter);
            wrapper.appendChild(pre);
        });
    }

    return doc.body.innerHTML;
}

export function generatePrintableHtml(title: string, html: string, options?: ExportOptions): string {
    const fontSize = options?.fontSize ?? 16;
    const lineHeight = options?.lineHeight ?? 1.6;
    const paragraphSpacing = options?.paragraphSpacing ?? 8;
    const accentColor = options?.accentColor ?? '#007AFF';

    return `<!DOCTYPE html>
<html lang="en" dir="auto">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.43/dist/katex.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..700&display=swap" rel="stylesheet">
    <style>
        /* Force WebKit/Blink print backgrounds */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
        }

        :root {
            /* Map theme tokens to what extensions consume */
            --primary:                  ${accentColor};
            --accent-color:             ${accentColor};
            --border-color:             rgba(0, 0, 0, 0.15);
            --border:                   #e0e0e0;
            --bg-color:                 #ffffff;
            --text-color:               #1a1a1a;
            --text:                     #1a1a1a;
            --bg:                       #ffffff;
            --code-block-bg:            #f6f8fa;
            --code-bg:                  rgba(0, 0, 0, 0.05);
            --quote-bg:                 #fafafa;
            --table-header-bg:          #f8f9fa;
            --table-header:             #f8f9fa;
            --placeholder-color:        #adb5bd;

            /* Spacing/Font controls passed from Options */
            --editor-font-family:       -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --editor-font-size:         ${fontSize}px;
            --editor-line-height:       ${lineHeight};
            --editor-paragraph-spacing: ${paragraphSpacing}px;
            --editor-list-item-spacing: ${paragraphSpacing / 4}px;
        }

        @media print {
            @page { margin: 2cm; }
            body { padding: 0; max-width: none !important; width: 100% !important; }
            .no-print { display: none; }
        }

        body {
            font-family: var(--editor-font-family);
            background-color: var(--bg-color);
            color: var(--text-color);
            max-width: 900px;
            margin: 0 auto;
            padding: 40px;
        }

        /* Ensure code blocks and inline code use the Fira Code web font in PDF export */
        pre, code, .code-gutter, .ProseMirror pre, .ProseMirror code, .ProseMirror :not(pre)>code {
            font-family: 'Fira Code', 'FiraCode', 'SF Mono', Monaco, Consolas, 'Courier New', monospace !important;
        }

        .print-mode {
            /* Force light-theme syntax highlighting for print/PDF */
            --hljs-bg:                  #f6f8fa;
            --hljs-color:               #383a42;
            --hljs-comment:             #a0a1a7;
            --hljs-keyword:             #a626a4;
            --hljs-section:             #e45649;
            --hljs-literal:             #0184bb;
            --hljs-string:              #50a14f;
            --hljs-attr:                #986801;
            --hljs-symbol:              #4078f2;
            --hljs-built_in:            #c18401;
        }

        /* Inject all generated styles (editor.css, highlight-theme.css, extension stylesheets) */
        ${GENERATED_CORE_STYLES}
    </style>
</head>
<body>
    <div class="ProseMirror print-mode">
        <article>${html}</article>
    </div>
</body>
</html>`;
}
