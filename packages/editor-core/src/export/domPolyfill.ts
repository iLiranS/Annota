let initPromise: Promise<void> | null = null;
let polyfilled = false;

export async function ensureDOMPolyfill(): Promise<void> {
    if (typeof document !== 'undefined') {
        polyfilled = true;
        return;
    }
    if (polyfilled) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
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
            polyfilled = true;
        } catch {
            console.warn(
                'ExportService: linkedom not found – install it for Markdown/PDF export in Node environment: npm install linkedom',
            );
        }
    })();

    return initPromise;
}
