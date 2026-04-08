import { mergeAttributes, Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import mermaid from 'mermaid';
import { createBlockMenuButton } from './block-menu-button';
import { generateBlockId } from './id-generator';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        insertMermaid: (options?: { code?: string }) => ReturnType;
    }
}


export const Mermaid = Node.create({
    name: 'mermaid',
    group: 'block',
    atom: true,

    addOptions() {
        return {
            onOpenBlockMenu: undefined as ((e: MouseEvent, resolve: () => { pos: number; message: Record<string, unknown> } | null) => void) | undefined,
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('id'),
                renderHTML: attributes => {
                    if (!attributes.id) return {};
                    return { id: attributes.id };
                },
            },
            code: {
                default: 'graph TD;\n  A-->B;\n  A-->C;\n  B-->D;\n  C-->D;',
            },
        };
    },

    addCommands() {
        return {
            insertMermaid: (options: { code?: string } = {}) => ({ chain }: { chain: any }) => {
                return chain()
                    .insertContent({
                        type: this.name,
                        attrs: options,
                    })
                    .run();
            },
        } as any;
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="mermaid"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                appendTransaction: (transactions, oldState, newState) => {
                    const docChanges = transactions.some(transaction => transaction.docChanged) && !oldState.doc.eq(newState.doc);
                    if (!docChanges) return;

                    const tr = newState.tr;
                    let modified = false;

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === this.name && !node.attrs.id) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateBlockId() });
                            modified = true;
                        }
                    });

                    if (modified) return tr;
                },
            }),
        ];
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div');
            dom.className = 'mermaid-block';

            // Scrollable preview wrapper
            const previewScroll = document.createElement('div');
            previewScroll.className = 'mermaid-preview-scroll';

            const preview = document.createElement('div');
            preview.className = 'mermaid-preview';

            previewScroll.appendChild(preview);

            // Zoom toolbar
            const zoomToolbar = document.createElement('div');
            zoomToolbar.className = 'mermaid-zoom-toolbar';

            const zoomOutBtn = document.createElement('button');
            zoomOutBtn.className = 'mermaid-zoom-btn';
            zoomOutBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
            zoomOutBtn.title = 'Zoom Out';
            zoomOutBtn.draggable = false;

            const zoomResetBtn = document.createElement('button');
            zoomResetBtn.className = 'mermaid-zoom-btn mermaid-zoom-label';
            zoomResetBtn.textContent = '100%';
            zoomResetBtn.title = 'Reset Zoom';
            zoomResetBtn.draggable = false;

            const zoomInBtn = document.createElement('button');
            zoomInBtn.className = 'mermaid-zoom-btn';
            zoomInBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
            zoomInBtn.title = 'Zoom In';
            zoomInBtn.draggable = false;

            zoomToolbar.appendChild(zoomOutBtn);
            zoomToolbar.appendChild(zoomResetBtn);
            zoomToolbar.appendChild(zoomInBtn);

            const editor_div = document.createElement('div');
            editor_div.className = 'mermaid-editor';
            editor_div.style.display = 'none';

            const textarea = document.createElement('textarea');
            textarea.value = node.attrs.code;
            textarea.className = 'mermaid-textarea';
            textarea.spellcheck = false;
            textarea.draggable = false;

            const render_button = document.createElement('button');
            render_button.textContent = 'Render Diagram';
            render_button.className = 'mermaid-render-btn';
            render_button.draggable = false;

            editor_div.appendChild(textarea);
            editor_div.appendChild(render_button);

            preview.draggable = false;
            dom.appendChild(previewScroll);
            dom.appendChild(zoomToolbar);
            dom.appendChild(editor_div);

            // Three-dot menu button
            const menuBtn = createBlockMenuButton({
                className: 'mermaid-menu-btn',
                onResolve: () => {
                    const pos = getPos();
                    if (typeof pos !== 'number') return null;

                    return {
                        pos: pos,
                        message: {
                            type: 'openBlockMenu',
                            blockType: 'mermaid',
                            data: {
                                pos: pos,
                                id: node.attrs.id,
                                code: node.attrs.code
                            }
                        }
                    };
                },
                onClick: this.options.onOpenBlockMenu || undefined
            });
            dom.appendChild(menuBtn);

            let isEditing = false;
            let currentRenderId = 0;
            let themeOverride: boolean | null = null;
            let currentZoom = 1;
            const ZOOM_STEP = 0.15;
            const MIN_ZOOM = 0.3;
            const MAX_ZOOM = 3;

            const applyZoom = () => {
                const svg = preview.querySelector('svg');
                if (svg) {
                    // Use the SVG's intrinsic size as the base
                    const intrinsicW = svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width / currentZoom;
                    const intrinsicH = svg.viewBox?.baseVal?.height || svg.getBoundingClientRect().height / currentZoom;
                    const scaledW = intrinsicW * currentZoom;
                    const scaledH = intrinsicH * currentZoom;
                    svg.style.width = `${scaledW}px`;
                    svg.style.height = `${scaledH}px`;
                    svg.style.minWidth = `${scaledW}px`;
                    svg.style.maxWidth = 'none';
                }
                zoomResetBtn.textContent = `${Math.round(currentZoom * 100)}%`;
            };

            zoomInBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
                applyZoom();
            };

            zoomOutBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
                applyZoom();
            };

            zoomResetBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentZoom = 1;
                // Clear explicit sizing so it returns to natural layout
                const svg = preview.querySelector('svg');
                if (svg) {
                    svg.style.width = '';
                    svg.style.height = '';
                    svg.style.minWidth = '';
                    svg.style.maxWidth = '';
                }
                zoomResetBtn.textContent = '100%';
            };

            // Prevent these zoom buttons from triggering ProseMirror interactions
            [zoomInBtn, zoomOutBtn, zoomResetBtn].forEach(btn => {
                btn.onmousedown = (e) => e.stopPropagation();
            });

            // --- Drag-to-pan ---
            let isPanning = false;
            let panStartX = 0;
            let panStartY = 0;
            let scrollStartX = 0;
            let scrollStartY = 0;
            let didPan = false;

            previewScroll.onmousedown = (e) => {
                // Only pan on primary button
                if (e.button !== 0) return;
                e.stopPropagation();
                isPanning = true;
                didPan = false;
                panStartX = e.clientX;
                panStartY = e.clientY;
                scrollStartX = previewScroll.scrollLeft;
                scrollStartY = previewScroll.scrollTop;
                previewScroll.classList.add('is-panning');
            };

            const onPanMove = (e: MouseEvent) => {
                if (!isPanning) return;
                const dx = e.clientX - panStartX;
                const dy = e.clientY - panStartY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPan = true;
                previewScroll.scrollLeft = scrollStartX - dx;
                previewScroll.scrollTop = scrollStartY - dy;
            };

            const onPanEnd = () => {
                if (!isPanning) return;
                isPanning = false;
                previewScroll.classList.remove('is-panning');
            };

            document.addEventListener('mousemove', onPanMove);
            document.addEventListener('mouseup', onPanEnd);

            const isDarkMode = () => {
                if (typeof themeOverride === 'boolean') return themeOverride;

                const root = document.documentElement;
                const body = document.body;
                const container = document.getElementById('editor-container');

                if (container?.getAttribute('data-theme') === 'dark') return true;
                if (root.getAttribute('data-theme') === 'dark' || body?.getAttribute('data-theme') === 'dark') return true;
                if (root.classList.contains('dark') || body?.classList.contains('dark')) return true;

                return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
            };

            const applyInlineFallbackStyles = (svgMarkup: string, isDark: boolean) => {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
                    const svgEl = doc.documentElement;
                    if (!svgEl || svgEl.nodeName !== 'svg') return svgMarkup;

                    const presentationAttributes = new Set([
                        'fill',
                        'stroke',
                        'stroke-width',
                        'stroke-dasharray',
                        'stroke-linecap',
                        'stroke-linejoin',
                        'stroke-miterlimit',
                        'fill-opacity',
                        'stroke-opacity',
                        'opacity',
                        'font-size',
                        'font-family',
                        'font-weight',
                        'font-style',
                        'text-anchor',
                        'dominant-baseline',
                        'letter-spacing',
                    ]);

                    const applyRule = (selector: string, declarations: Record<string, string>) => {
                        let elements: NodeListOf<Element>;
                        try {
                            elements = doc.querySelectorAll(selector);
                        } catch {
                            return;
                        }
                        elements.forEach((el) => {
                            Object.entries(declarations).forEach(([prop, value]) => {
                                const cleanValue = value.replace(/!important/g, '').trim();
                                if (!cleanValue) return;
                                if (presentationAttributes.has(prop)) {
                                    el.setAttribute(prop, cleanValue);
                                } else {
                                    const existing = el.getAttribute('style');
                                    const next = existing ? `${existing}; ${prop}: ${cleanValue}` : `${prop}: ${cleanValue}`;
                                    el.setAttribute('style', next);
                                }
                            });
                        });
                    };

                    const styleNodes = Array.from(doc.querySelectorAll('style'));
                    const cssText = styleNodes.map(node => node.textContent || '').join('\n');
                    styleNodes.forEach(node => node.remove());

                    cssText.split('}').forEach((rule) => {
                        const parts = rule.split('{');
                        if (parts.length < 2) return;
                        const selectorPart = parts[0].trim();
                        const declarationsPart = parts.slice(1).join('{').trim();
                        if (!selectorPart || selectorPart.startsWith('@')) return;
                        if (!declarationsPart) return;

                        const declarations = declarationsPart.split(';').reduce<Record<string, string>>((acc, decl) => {
                            const [rawProp, rawValue] = decl.split(':').map(part => part?.trim());
                            if (!rawProp || !rawValue) return acc;
                            acc[rawProp] = rawValue;
                            return acc;
                        }, {});

                        const selectors = selectorPart.split(',').map(sel => sel.trim()).filter(Boolean);
                        selectors.forEach((selector) => applyRule(selector, declarations));
                    });

                    const fallbackTextColor = isDark ? '#E2E8F0' : '#0F172A';
                    doc.querySelectorAll('text, tspan').forEach((el) => {
                        if (!el.getAttribute('fill')) {
                            el.setAttribute('fill', fallbackTextColor);
                        }
                    });

                    return svgEl.outerHTML;
                } catch {
                    return svgMarkup;
                }
            };

            const render = async () => {
                const myRenderId = ++currentRenderId;
                const codeToRender = node.attrs.code;

                try {
                    preview.innerHTML = '<div class="mermaid-loading">Rendering Diagram...</div>';

                    const isDark = isDarkMode();

                    mermaid.initialize({
                        startOnLoad: false,
                        theme: isDark ? 'dark' : 'default',
                        securityLevel: 'loose',
                    });

                    // Generate a unique ID for the mermaid div
                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

                    // Render (id, text, container)
                    const { svg } = await mermaid.render(id, codeToRender);

                    // Only update if no other render started after this one
                    if (myRenderId === currentRenderId) {
                        preview.innerHTML = applyInlineFallbackStyles(svg, isDark);
                    }
                } catch (error) {
                    console.error("Mermaid syntax error:", error);
                    // Standard mermaid error behavior: it might have already rendered an error SVG
                    if (myRenderId === currentRenderId) {
                        preview.innerHTML = '<div class="mermaid-error">Syntax Error - Click to edit</div>';
                    }
                }
            };

            // Double-click opens the code editor (single-click is reserved for panning)
            previewScroll.ondblclick = (e) => {
                if (!editor.isEditable) return;
                e.preventDefault();
                e.stopPropagation();
                isEditing = true;
                previewScroll.style.display = 'none';
                zoomToolbar.style.display = 'none';
                editor_div.style.display = 'flex';
                textarea.focus();
            };

            render_button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isEditing = false;
                const newCode = textarea.value;

                previewScroll.style.display = '';
                zoomToolbar.style.display = '';
                editor_div.style.display = 'none';

                // Reset zoom on re-render
                currentZoom = 1;
                const svg = preview.querySelector('svg');
                if (svg) {
                    svg.style.width = '';
                    svg.style.height = '';
                    svg.style.minWidth = '';
                    svg.style.maxWidth = '';
                }
                zoomResetBtn.textContent = '100%';

                if (typeof getPos === 'function') {
                    editor.commands.updateAttributes('mermaid', { code: newCode });
                } else {
                    render();
                }
            };

            // Prevent ProseMirror from dragging, selecting or PASTING while editing
            textarea.onmousedown = (e) => e.stopPropagation();
            textarea.onmousemove = (e) => e.stopPropagation(); // Block mouse movements from triggering drag
            textarea.onkeydown = (e) => e.stopPropagation();
            textarea.onpaste = (e) => e.stopPropagation();
            textarea.onclick = (e) => e.stopPropagation();
            textarea.onselectstart = (e) => e.stopPropagation();
            textarea.ondragstart = (e) => e.stopPropagation();

            // Watch the HTML tag for theme changes so the diagram adapts automatically
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
                        // Only re-render if we aren't currently editing the raw code
                        if (!isEditing) {
                            render();
                        }
                    }
                });
            });

            const observeTarget = (el: Element | null) => {
                if (!el) return;
                observer.observe(el, {
                    attributes: true,
                    attributeFilter: ['class', 'data-theme']
                });
            };

            // Start observing the root, body, and editor container for theme changes
            observeTarget(document.documentElement);
            observeTarget(document.body);
            observeTarget(document.getElementById('editor-container'));

            const onThemeChange = (event: Event) => {
                const detail = (event as CustomEvent)?.detail;
                if (typeof detail?.isDark === 'boolean') {
                    themeOverride = detail.isDark;
                }
                if (!isEditing) render();
            };

            window.addEventListener('annota-theme-change', onThemeChange as EventListener);

            render();

            return {
                dom,
                update: (newNode) => {
                    if (newNode.type.name !== node.type.name) return false;

                    // Always update local reference to the newest node
                    const oldCode = node.attrs.code;
                    node = newNode;

                    // If attributes changed, sync textarea and consider re-rendering
                    if (node.attrs.code !== oldCode) {
                        textarea.value = node.attrs.code;
                        if (!isEditing) render();
                    }
                    return true;
                },
                destroy: () => {
                    window.removeEventListener('annota-theme-change', onThemeChange as EventListener);
                    observer.disconnect();
                    document.removeEventListener('mousemove', onPanMove);
                    document.removeEventListener('mouseup', onPanEnd);
                },
                stopEvent: (event) => {
                    const target = event.target as HTMLElement;
                    // Always stop events on zoom buttons
                    if (zoomToolbar.contains(target)) return true;
                    return isEditing && (target === textarea || textarea.contains(target) || target === render_button);
                },
                ignoreMutation: () => {
                    // Always ignore — zoom transform and SVG renders both mutate the DOM
                    return true;
                }
            };
        };
    },
});
