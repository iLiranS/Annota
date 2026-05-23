/// <reference path="./turndown-plugin-gfm.d.ts" />
import hljs from 'highlight.js';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { ExportAdapter } from './types';
import { SHORT_TO_HEX } from '../extensions/marks';
import { GENERATED_CORE_STYLES } from './generated-styles';

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

export interface ExportOptions {
    fontSize?: number;
    lineHeight?: number;
    paragraphSpacing?: number;
    accentColor?: string;
    numberedLines?: boolean;
}

export class ExportService {
    private turndownService: TurndownService | null = null;
    private initPromise: Promise<void> | null = null;

    constructor(private adapter: ExportAdapter) { }

    // ─── Lazy async init ──────────────────────────────────────────────────────

    private async ensureTurndown(): Promise<void> {
        if (this.turndownService) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            let docReady = typeof document !== 'undefined';

            if (!docReady) {
                try {
                    const linkedom = await import('linkedom');
                    const { parseHTML } = linkedom;

                    // Use linkedom's native DOMParser — it correctly handles
                    // getElementById, body, firstChild etc. unlike parseHTML wrappers.
                    const LinkedomDOMParser = (linkedom as any).DOMParser;

                    const parsed = parseHTML('<!DOCTYPE html><html><body></body></html>');
                    const shimDoc = parsed.document as any;

                    // Patch linkedom documents so TurndownService's browser
                    // build can call doc.open/write/close without crashing.
                    const patchDoc = (d: any) => {
                        if (!d.open) d.open = () => { };
                        if (!d.write) d.write = () => { };
                        if (!d.close) d.close = () => { };
                        return d;
                    };
                    patchDoc(shimDoc);

                    // TurndownService calls document.implementation.createHTMLDocument()
                    if (!shimDoc.implementation) {
                        shimDoc.implementation = {
                            createHTMLDocument: (title = '') => {
                                const inner = parseHTML(
                                    `<!DOCTYPE html><html><head><title>${title}</title></head><body></body></html>`,
                                ).document as any;
                                patchDoc(inner);
                                if (!inner.implementation) {
                                    inner.implementation = shimDoc.implementation;
                                }
                                return inner;
                            },
                        };
                    }

                    // Polyfill globals — must happen BEFORE new TurndownService()
                    const g = globalThis as Record<string, unknown>;
                    g['document'] = shimDoc;
                    g['Node'] = parsed.Node;
                    g['Element'] = parsed.Element;
                    g['HTMLElement'] = parsed.HTMLElement;

                    // linkedom's DOMParser puts fragment content OUTSIDE <body>
                    // (as siblings of <head>/<body>), so doc.body.innerHTML is
                    // empty and getElementById can't find elements.
                    // Fix: always wrap fragments in a full HTML shell.
                    if (LinkedomDOMParser) {
                        const LDP = LinkedomDOMParser;
                        g['DOMParser'] = class {
                            parseFromString(html: string, mime: string) {
                                const wrapped = html.includes('<html')
                                    ? html
                                    : `<!DOCTYPE html><html><body>${html}</body></html>`;
                                const doc = new LDP().parseFromString(wrapped, mime);
                                // Polyfill table.rows for turndown-plugin-gfm
                                doc.querySelectorAll?.('table')?.forEach?.((t: any) => {
                                    if (!t.rows) {
                                        Object.defineProperty(t, 'rows', {
                                            get() { return this.querySelectorAll('tr'); },
                                        });
                                    }
                                });
                                return doc;
                            }
                        };
                    }

                    docReady = true;
                } catch {
                    console.warn(
                        'ExportService: linkedom not found – install it for Markdown export: npm install linkedom',
                    );
                }
            }

            if (!docReady) return;

            this.turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced',
                emDelimiter: '_',
                strongDelimiter: '**',
            });
            this.turndownService.use(gfm);
            this.setupCustomRules(this.turndownService);
        })();

        return this.initPromise;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    async triggerMarkdownExport(title: string, rawHtml: string): Promise<void> {
        // Detect if we are running in React Native
        const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

        let markdown = '';

        if (isReactNative) {
            // Bypass Turndown and DOM polyfills entirely on mobile
            markdown = this.regexHtmlToMarkdown(rawHtml);
        } else {
            // Desktop: Use the robust Turndown engine
            await this.ensureTurndown();
            if (!this.turndownService) {
                markdown = this.regexHtmlToMarkdown(rawHtml); // Fallback just in case
            } else {
                markdown = this.turndownService.turndown(rawHtml);
            }
        }

        const safeTitle = this.sanitizeFilename(title);
        await this.adapter.exportMarkdown(`${safeTitle}.md`, markdown);
    }

    // ─── Pure JS Fallback for Mobile ──────────────────────────────────────────
    private regexHtmlToMarkdown(html: string): string {
        let md = html;

        // 1. Custom Annota Extensions
        md = md.replace(/<div[^>]*data-type="mermaid"[^>]*code="([^"]*)"[^>]*>.*?<\/div>/gis, '\n\n```mermaid\n$1\n```\n\n');
        md = md.replace(/<div[^>]*data-type="details"[^>]*>(.*?)<\/div>/gis, '\n<details>\n$1\n</details>\n');
        md = md.replace(/<div[^>]*data-type="detailsSummary"[^>]*>(.*?)<\/div>/gis, '<summary>$1</summary>\n');
        md = md.replace(/<div[^>]*data-type="detailsContent"[^>]*>(.*?)<\/div>/gis, '$1\n');
        md = md.replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gis, '- [x] $1\n');
        md = md.replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gis, '- [ ] $1\n');
        md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gis, '==$1==');

        // 2. Standard HTML Tags
        md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n');
        md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n');
        md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n');
        md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
        md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**');
        md = md.replace(/<em[^>]*>(.*?)<\/em>/gis, '_$1_');
        md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n\n```\n$1\n```\n\n');
        md = md.replace(/<code[^>]*>(.*?)<\/code>/gis, '`$1`');
        md = md.replace(/<br\s*\/?>/gis, '\n');

        // 3. Cleanup
        md = md.replace(/<[^>]+>/g, ''); // Strip remaining tags
        md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

        return md.trim();
    }

    async triggerPdfExport(
        title: string,
        rawHtml: string,
        options?: ExportOptions
    ): Promise<void> {
        // Ensure DOM polyfills are set up (needed for preprocessHtmlForPrint on mobile)
        await this.ensureTurndown();
        const processedHtml = await this.preprocessHtmlForPrint(rawHtml, options);
        const printReadyHtml = this.generatePrintableHtml(title, processedHtml, options);
        const safeTitle = this.sanitizeFilename(title);
        await this.adapter.exportPdf(safeTitle, printReadyHtml);
    }

    // ─── Pre-processing ───────────────────────────────────────────────────────

    private async preprocessHtmlForPrint(html: string, options?: ExportOptions): Promise<string> {
        const g = globalThis as Record<string, unknown>;
        const activeDoc: any =
            typeof document !== 'undefined' ? document : (g['document'] ?? null);

        if (!activeDoc) return html;

        const DOMParserCtor: any =
            typeof DOMParser !== 'undefined' ? DOMParser : (g['DOMParser'] as any);

        const doc: any = new DOMParserCtor().parseFromString(html, 'text/html');

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
                    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

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
        // The clean serialized format has no <label>/<input>/<div> wrappers,
        // but the print CSS expects them for checkbox rendering and flex layout.
        // Inject the checkbox UI and wrap content in a <div> to match the
        // editor's NodeView DOM structure that the CSS targets.
        const taskLists: any[] = Array.from(doc.querySelectorAll('ul[data-type="taskList"]'));
        for (const ul of taskLists) {
            const items: any[] = Array.from(ul.querySelectorAll(':scope > li[data-checked]'));
            for (const li of items) {
                // Skip if already hydrated (has a <label> child)
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
                    el.removeAttribute('draggable'); // Clean up UI-specific attributes
                }
            });

        // 3. Inline Images to Base64 ───────────────────────────────────────────
        // Print engines struggle with local file URIs and loading times.
        // We fetch the images and embed them directly into the HTML as raw data.
        const imgNodes = Array.from(doc.querySelectorAll('img'));
        for (const img of imgNodes) {
            const el = img as HTMLElement;
            let src = el.getAttribute('src');
            const imageId = el.getAttribute('data-image-id');

            // 1. If src is missing or empty but we have a data-image-id, ask the platform to resolve it
            if ((!src || src === "") && imageId && this.adapter.resolveImage) {
                try {
                    const resolved = await this.adapter.resolveImage(imageId);
                    if (resolved) {
                        el.setAttribute('src', resolved);
                        src = resolved;
                    }
                } catch (err) {
                    console.warn(`ExportService: Failed to resolve data-image-id ${imageId}`, err);
                }
            }

            // 2. Skip if it's already a base64 string or empty (and resolver couldn't fix it)
            if (!src || src.startsWith('data:')) continue;

            try {
                // Use a generous timeout for asset loading
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

                // Add attributes to help the browser render it immediately
                el.setAttribute('loading', 'eager');
                el.setAttribute('decoding', 'sync');

                // Reinforce print-safe dimensions
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
                            el.textContent = `$$${formula}$$`; // Fallback to raw text if render fails
                        }
                    }
                }
            } catch (err) {
                console.warn('ExportService: KaTeX pre-render failed', err);
            }
        }

        // 5. Code Highlighting ─────────────────────────────────────────────
        const codeNodes = Array.from(doc.querySelectorAll('pre code'));
        for (const node of codeNodes) {
            const el = node as HTMLElement;
            // 1. Get the language from class or data-language
            const classMatch = el.className.match(/language-([a-zA-Z0-9_+\-#]+)/);
            const parentLang = el.parentElement?.getAttribute('data-language');
            let lang = classMatch ? classMatch[1] : (parentLang || 'plaintext');
            if (lang === 'null' || lang === 'undefined' || lang === 'auto') {
                lang = 'plaintext';
            }

            // 2. Skip if it already contains span tags (already highlighted)
            if (el.querySelector('span')) continue;

            // 3. Highlight with Highlight.js
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

        // 6. Handle code block line numbers ──────────────────────────────────
        if (options?.numberedLines !== false) {
            doc.querySelectorAll('pre').forEach((pre: any) => {
                // Walk up the DOM using a simple compatible loop to see if we are inside a mermaid block
                let isInsideMermaid = false;
                let current = pre;
                while (current) {
                    if (current.getAttribute?.('data-type') === 'mermaid' || current.classList?.contains('mermaid-block')) {
                        isInsideMermaid = true;
                        break;
                    }
                    current = current.parentNode;
                }
                
                // Skip if inside mermaid or already wrapped
                if (isInsideMermaid || pre.parentElement?.classList?.contains('code-block-wrapper')) {
                    return;
                }

                const codeEl = pre.querySelector('code');
                const text = codeEl?.textContent || pre.textContent || '';
                
                // Remove trailing newline to match editor line counting exactly
                const lines = text.replace(/\n$/, '').split('\n');
                const lineCount = lines.length;

                // Create code wrapper
                const wrapper = doc.createElement('div');
                wrapper.className = 'code-block-wrapper';

                // Create gutter
                const gutter = doc.createElement('div');
                gutter.className = 'code-gutter';
                gutter.setAttribute('contenteditable', 'false');

                for (let i = 1; i <= lineCount; i++) {
                    const span = doc.createElement('span');
                    span.textContent = String(i);
                    gutter.appendChild(span);
                }

                // Insert wrapper and relocate components
                pre.parentNode?.insertBefore(wrapper, pre);
                wrapper.appendChild(gutter);
                wrapper.appendChild(pre);
            });
        }

        return doc.body.innerHTML;
    }

    // ─── HTML shell ───────────────────────────────────────────────────────────
    // No injected title header — users control their own content headings.

    private generatePrintableHtml(title: string, html: string, options?: ExportOptions): string {
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

    // ─── Turndown custom rules ────────────────────────────────────────────────

    private setupCustomRules(td: TurndownService) {
        td.addRule('mermaid', {
            filter: (node) =>
                node.nodeName === 'DIV' &&
                (node.getAttribute('data-type') === 'mermaid' ||
                    node.classList.contains('mermaid-block')),
            replacement: (_, node) => {
                const code =
                    (node as HTMLElement).getAttribute('code') ??
                    (node as HTMLElement).querySelector('.mermaid-textarea')?.textContent ??
                    '';
                return `\n\n\`\`\`mermaid\n${code}\n\`\`\`\n\n`;
            },
        });

        td.addRule('details', {
            filter: (node) =>
                node.nodeName === 'DIV' && node.getAttribute('data-type') === 'details',
            replacement: (content) => `\n\n<details>\n${content}\n</details>\n\n`,
        });

        td.addRule('detailsSummary', {
            filter: (node) =>
                node.nodeName === 'DIV' && node.getAttribute('data-type') === 'detailsSummary',
            replacement: (content) => `<summary>${content.trim()}</summary>\n`,
        });

        td.addRule('detailsContent', {
            filter: (node) =>
                node.nodeName === 'DIV' && node.getAttribute('data-type') === 'detailsContent',
            replacement: (content) => `\n${content}\n`,
        });

        td.addRule('taskItem', {
            filter: (node) =>
                node.nodeName === 'LI' &&
                (node.hasAttribute('data-checked') || node.classList.contains('task-list-item')),
            replacement: (content, node) => {
                const checked =
                    (node as HTMLElement).getAttribute('data-checked') === 'true' ||
                    !!(node as HTMLElement).querySelector('input[type="checkbox"][checked]');
                return `- ${checked ? '[x]' : '[ ]'} ${content.trim()}\n`;
            },
        });

        td.addRule('highlight', {
            filter: (node) =>
                node.nodeName === 'MARK' ||
                (node.nodeName === 'SPAN' && !!(node as HTMLElement).style?.backgroundColor),
            replacement: (content) => `==${content}==`,
        });
    }

    private sanitizeFilename(title: string): string {
        return (title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
}
