/// <reference path="./turndown-plugin-gfm.d.ts" />
import hljs from 'highlight.js';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { ExportAdapter } from './types';

export interface ExportOptions {
    fontSize?: number;
    lineHeight?: number;
    paragraphSpacing?: number;
    accentColor?: string;
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
        md = md.replace(/<li[^>]*task-list-item[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gis, '- [x] $1\n');
        md = md.replace(/<li[^>]*task-list-item[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gis, '- [ ] $1\n');
        md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gis, '==$1==');

        // 2. Standard HTML Tags
        md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n');
        md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n');
        md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n');
        md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
        md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**');
        md = md.replace(/<em[^>]*>(.*?)<\/em>/gis, '_$1_');
        md = md.replace(/<br\s*\/?>/gis, '\n');

        // 3. Cleanup
        md = md.replace(/<[^>]+>/g, ''); // Strip remaining tags
        md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

        return md.trim();
    }

    async triggerPdfExport(
        title: string,
        rawHtml: string,
        options?: ExportOptions
    ): Promise<void> {
        // Ensure DOM polyfills are set up (needed for preprocessHtmlForPrint on mobile)
        await this.ensureTurndown();
        const processedHtml = await this.preprocessHtmlForPrint(rawHtml);
        const printReadyHtml = this.generatePrintableHtml(title, processedHtml, options);
        const safeTitle = this.sanitizeFilename(title);
        await this.adapter.exportPdf(safeTitle, printReadyHtml);
    }

    // ─── Pre-processing ───────────────────────────────────────────────────────

    private async preprocessHtmlForPrint(html: string): Promise<string> {
        const g = globalThis as Record<string, unknown>;
        const activeDoc: any =
            typeof document !== 'undefined' ? document : (g['document'] ?? null);

        if (!activeDoc) return html;

        const DOMParserCtor: any =
            typeof DOMParser !== 'undefined' ? DOMParser : (g['DOMParser'] as any);

        const doc: any = new DOMParserCtor().parseFromString(html, 'text/html');

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
                        const b64 = typeof btoa !== 'undefined' ? btoa(utf8) : Buffer.from(utf8).toString('base64');
                        node.innerHTML = `<img src="https://mermaid.ink/svg/${b64}" style="max-width: 100%; height: auto; margin: 1.5em auto; display: block;" />`;
                        node.removeAttribute('code');
                    } catch (e) {
                        console.error('ExportService: Mermaid base64 encoding failed on mobile', e);
                    }
                }
            }
        }

        // 2. Promote background colours and fix Image/Table collapsing ─────────
        doc.querySelectorAll('[data-type="details"],[data-type="detailsSummary"],td,th,mark,[style*="background"],img,table')
            .forEach((el: HTMLElement) => {
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
            const classMatch = el.className.match(/language-(\w+)/);
            const parentLang = el.parentElement?.getAttribute('data-language');
            const lang = classMatch ? classMatch[1] : (parentLang || 'plaintext');

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

        return doc.body.innerHTML;
    }

    // ─── HTML shell ───────────────────────────────────────────────────────────
    // No injected title header — users control their own content headings.

    private generatePrintableHtml(title: string, html: string, options?: ExportOptions): string {
        const fontSize = options?.fontSize ?? 16;
        const lineHeight = options?.lineHeight ?? 1.6;
        const paragraphSpacing = (options?.paragraphSpacing ?? 8) / 2; // Split for top/bottom
        const accentColor = options?.accentColor ?? '#007AFF';

        const styles = /* css */ `
            /* Force all backgrounds to print — critical for WebKit / WKWebView */
            * {
                -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                box-sizing: border-box;
            }

            :root {
                --primary:      ${accentColor};
                --text:         #1a1a1a;
                --bg:           #ffffff;
                --border:       #e0e0e0;
                --code-bg:      #f5f5f5;
                --table-header: #f8f9fa;
            }

            @media print {
                @page { margin: 2cm; }
                body  { padding: 0; max-width: none !important; width: 100% !important; }
                .no-print { display: none; }
                [data-type="details"],
                .details-wrapper { break-inside: avoid; }
                table { break-inside: auto; }
                tr { break-inside: avoid; break-after: auto; }
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                             Roboto, Helvetica, Arial, sans-serif;
                line-height:      ${lineHeight};
                font-size:        ${fontSize}px;
                color:            var(--text);
                max-width:        900px;
                margin:           0 auto;
                padding:          40px;
                background-color: var(--bg);
            }

            h1, h2, h3, h4, h5, h6 {
                margin: 0;
                padding-top: ${paragraphSpacing * 2.5}px;
                padding-bottom: ${paragraphSpacing * 1.5}px;
                font-weight:   500;
                color:         #000;
                line-height:   1.2;
            }
            h1 { 
                font-size: 2.1em; 
                border-bottom: 1.5px solid #f2f2f2; 
                padding-bottom: .2em; 
                margin-top: ${paragraphSpacing * 1.5}px;
                font-weight: 700;
            }
            h2 { 
                font-size: 1.7em; 
                border-bottom: 1px solid #f2f2f2; 
                padding-bottom: .2em;
                margin-top: ${paragraphSpacing * 1.25}px;
            }
            h3 { font-size: 1.4em; }

            p { 
                margin: 0;
                padding-top: ${paragraphSpacing}px;
                padding-bottom: ${paragraphSpacing}px;
            }
            a { color: var(--primary); text-decoration: underline; }

            hr {
                border: none;
                height: 1px;
                background-color: var(--border);
                opacity: 0.5;
                margin: ${paragraphSpacing * 2}px 0;
            }

            img {
                max-width:     100%;
                height:        auto;
                border-radius: 8px;
                margin:        1em 0;
                box-shadow:    0 4px 12px rgba(0,0,0,.1);
            }

            /* ── Code Blocks (Atom One Light Theme) ───────────────────────── */
            pre, .code-block-wrapper pre {
                font-family: 'FiraCode', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
                font-size:   0.85em !important;
                position:    relative !important;
                padding:     1.2em !important;
                margin:      1.5em 0 !important;
                background-color: #f6f8fa !important;
                border:      1px solid #d0d7de !important;
                border-radius: 12px !important;
                line-height: 1.5 !important;
                display:     block !important;
                white-space: pre-wrap !important;
                word-break:  break-all !important;
                color:       #383a42 !important;
                overflow:    visible !important;
            }
            code, .code-block-wrapper code {
                font-family: inherit !important;
                background:  none !important;
                padding:     0 !important;
                border:      none !important;
                color:       inherit !important;
            }
            
            .hljs-comment, .hljs-quote { color: #a0a1a7 !important; font-style: italic; }
            .hljs-doctag, .hljs-keyword, .hljs-formula { color: #a626a4 !important; }
            .hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst { color: #e45649 !important; }
            .hljs-literal { color: #0184bb !important; }
            .hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta .hljs-string { color: #50a14f !important; }
            .hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number { color: #986801 !important; }
            .hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title { color: #4078f2 !important; }
            .hljs-built_in, .hljs-title.class_, .hljs-class .hljs-title { color: #c18401 !important; }
            .hljs-emphasis { font-style: italic; }
            .hljs-strong { font-weight: 500; }
            .hljs-link { text-decoration: underline; }

            /* ── Lists ──────────────────────────────────────────────────────── */
            ul, ol { margin: ${paragraphSpacing}px 0; }
            li { padding-bottom: ${paragraphSpacing / 2}px; }
            ul li::marker { color: var(--primary); }
            ol li::marker { color: var(--primary); font-weight: 600; }

            /* ── Math ───────────────────────────────────────────────────────── */
            .katex-display { margin: 1.2em 0 !important; }
            .katex { font-size: 1.15em !important; }

            /* Don't style mermaid <pre> as code blocks */
            pre.mermaid { background: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }

            blockquote {
                margin:        1.5em 0;
                padding:       .8em 1.5em;
                color:         #555;
                background:    #fafafa;
                border-left:   5px solid var(--primary);
                border-radius: 0 8px 8px 0;
                font-style:    italic;
            }

            /* ── Tables ─────────────────────────────────────────────────────── */
            table {
                display:         table !important;
                width:           100% !important;
                min-width:       100% !important;
                border-collapse: collapse;
                margin:          2em 0;
                font-size:       .95em;
                table-layout:    auto;
            }
            .tableWrapper {
                width:           100% !important;
                margin:          2em 0 !important;
                overflow:        visible !important;
            }
            th, td {
                padding:        10px 14px;
                border:         1px solid var(--border);
                text-align:     left;
                vertical-align: top;
                word-break:     break-word;
                overflow-wrap:  anywhere;
            }
            th {
                background-color: var(--table-header) !important;
                font-weight:      700;
                color:            #333;
            }
            tr:nth-child(even) td { background-color: #fafafa !important; }

            /* ── Details / Summary ──────────────────────────────────────────── */
            [data-type="details"],
            .details-wrapper,
            details {
                border:        1px solid var(--border);
                border-radius: 8px;
                margin:        1.5em 0;
                overflow:      hidden;
                box-shadow:    0 2px 5px rgba(0,0,0,.05);
            }
            [data-type="detailsSummary"],
            summary {
                padding:     6px 14px;
                background:  rgba(0,0,0,.03);
                font-weight: 700;
                display:     flex;
                align-items: center;
                gap:         8px;
                list-style:  none;
            }
            summary h1, summary h2, summary h3, summary h4, summary h5, summary h6, summary p,
            [data-type="detailsSummary"] h1, [data-type="detailsSummary"] h2, [data-type="detailsSummary"] h3, 
            [data-type="detailsSummary"] h4, [data-type="detailsSummary"] h5, [data-type="detailsSummary"] h6, 
            [data-type="detailsSummary"] p {
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                line-height: 1.2 !important;
            }
            [data-type="detailsContent"],
            .details-content {
                padding: 0px 14px;
                border-top: 1px solid var(--border);
            }

            /* ── Mermaid ────────────────────────────────────────────────────── */
            [data-type="mermaid"],
            .mermaid-block {
                display:         flex;
                justify-content: center;
                margin:          2.5em 0;
                padding:         1em;
                border:          1px solid var(--border);
                border-radius:   14px;
                background:      #fff;
            }
            svg { max-width: 100%; height: auto; }

            /* ── Task lists ─────────────────────────────────────────────────── */
            ul.task-list, [data-type="taskList"] {
                list-style: none !important;
                padding-left: 0.5em !important;
                margin: 1em 0 !important;
            }
            li.task-list-item, li[data-type="taskItem"] {
                display:       flex !important;
                align-items:   flex-start !important;
                gap:           12px !important;
                margin-bottom: 4px !important;
                list-style:    none !important;
            }
            li.task-list-item > label, li[data-type="taskItem"] > label {
                margin-top:    0.3em !important;
                flex-shrink:   0 !important;
                display:       flex !important;
                align-items:   center !important;
            }
            li.task-list-item > div, li[data-type="taskItem"] > div {
                flex:          1 !important;
                min-width:     0 !important;
            }
            li.task-list-item p, li[data-type="taskItem"] p {
                margin: 0 !important;
                padding: 0 !important;
            }
            input[type="checkbox"] {
                width: 1.15em !important;
                height: 1.15em !important;
                margin: 0 !important;
                cursor: pointer !important;
                accent-color: var(--primary) !important;
            }

            mark { border-radius: 3px; padding: 0 2px; }
            .page-break { page-break-after: always; }
        `;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.43/dist/katex.min.css">
    <style>${styles}</style>
</head>
<body>
    <article>${html}</article>
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
                node.nodeName === 'LI' && node.classList.contains('task-list-item'),
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
