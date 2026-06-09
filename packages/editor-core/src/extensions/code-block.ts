import { textblockTypeInputRule } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { TextSelection } from '@tiptap/pm/state';
import { sendMessage } from '../bridge';
import './code-block.css';

// Supported languages for the inline selector
export const CODE_LANGUAGES = [
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

let loadedLowlight: any = null;
let isLoadingLowlight = false;
const pendingCallbacks: (() => void)[] = [];

export async function loadLowlight() {
    if (loadedLowlight) return loadedLowlight;
    if (isLoadingLowlight) {
        return new Promise<any>((resolve) => {
            pendingCallbacks.push(() => resolve(loadedLowlight));
        });
    }

    isLoadingLowlight = true;
    try {
        const { common, createLowlight } = await import('lowlight');
        loadedLowlight = createLowlight(common);
        
        // Trigger a re-render of all editors to apply syntax highlighting
        if (typeof window !== 'undefined' && window.editor) {
            const editor = window.editor;
            const { state } = editor;
            if (state) {
                editor.view.dispatch(state.tr.replace(0, state.doc.content.size, state.doc.slice(0)));
            }
        }
        
        while (pendingCallbacks.length > 0) {
            const cb = pendingCallbacks.shift();
            if (cb) cb();
        }
    } catch (error) {
        console.error("Failed to load lowlight dynamically:", error);
    } finally {
        isLoadingLowlight = false;
    }
    return loadedLowlight;
}

// Proxy lowlight implementation that satisfies Tiptap requirements
export const lowlight: any = {
    highlight(language: string, value: string, options?: any) {
        if (!loadedLowlight) {
            loadLowlight();
            return { value: [], children: [] };
        }
        return loadedLowlight.highlight(language, value, options);
    },
    highlightAuto(value: string, options?: any) {
        if (!loadedLowlight) {
            loadLowlight();
            return { value: [], children: [] };
        }
        return loadedLowlight.highlightAuto(value, options);
    },
    listLanguages() {
        if (!loadedLowlight) {
            loadLowlight();
            // Return common programming languages we support as a fallback
            return CODE_LANGUAGES.map(l => l.value).filter((v): v is string => v !== null);
        }
        return loadedLowlight.listLanguages();
    },
    registered(aliasOrName: string) {
        if (!loadedLowlight) {
            return false;
        }
        if (typeof loadedLowlight.registered === 'function') {
            return loadedLowlight.registered(aliasOrName);
        }
        return false;
    }
};

export const backtickInputRegex = /^```(?!mermaid[\s\n])([a-zA-Z0-9_+\-#]+)?[\s\n]$/;
export const tildeInputRegex = /^~~~(?!mermaid[\s\n])([a-zA-Z0-9_+\-#]+)?[\s\n]$/;

function mapLanguageAlias(alias: string | undefined): string | null {
    if (!alias) return null;
    const lower = alias.toLowerCase().trim();
    
    // Direct match against CODE_LANGUAGES value
    const match = CODE_LANGUAGES.find(l => l.value === lower);
    if (match) return match.value;
    
    // Explicit alias mappings
    const aliases: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'md': 'markdown',
        'yml': 'yaml',
        'docker': 'dockerfile',
        'c++': 'cpp',
        'c#': 'csharp',
        'cs': 'csharp',
        'sh': 'bash',
        'shell': 'bash',
        'rs': 'rust',
        'rb': 'ruby',
        'text': 'plaintext',
        'txt': 'plaintext',
        'htm': 'html',
    };
    
    return aliases[lower] || lower;
}

// Custom CodeBlock with native interaction
export const CustomCodeBlock = CodeBlockLowlight.extend<any>({
    addOptions() {
        return {
            ...this.parent?.(),
            onOpenBlockMenu: null,
            onCodeBlockSelected: null,
        };
    },
    addCommands() {
        return {
            ...this.parent?.(),
            toggleCodeBlock:
                (attributes?: { language?: string }) =>
                ({ state, dispatch, commands }) => {
                    if (this.editor.isActive('codeBlock')) {
                        return commands.toggleNode(this.name, 'paragraph', attributes);
                    }

                    const { selection } = state;
                    const { from, to } = selection;

                    // Collect all textblock nodes in the selection
                    const textBlocks: { node: any; pos: number }[] = [];
                    state.doc.nodesBetween(from, to, (node, pos) => {
                        if (node.isTextblock) {
                            textBlocks.push({ node, pos });
                            return false; // do not descend into textblocks
                        }
                        return true;
                    });

                    if (textBlocks.length <= 1) {
                        return commands.toggleNode(this.name, 'paragraph', attributes);
                    }

                    // Extract text content and join with newlines
                    const text = textBlocks.map(tb => tb.node.textContent).join('\n');
                    const start = textBlocks[0].pos;
                    const lastBlock = textBlocks[textBlocks.length - 1];
                    const end = lastBlock.pos + lastBlock.node.nodeSize;

                    if (dispatch) {
                        const codeBlockNode = state.schema.nodes.codeBlock.create(
                            { language: attributes?.language ?? null },
                            text ? state.schema.text(text) : undefined
                        );

                        const tr = state.tr.replaceWith(start, end, codeBlockNode);

                        // Set selection inside the code block
                        const selectionPos = Math.min(start + 1, tr.doc.content.size);
                        const $pos = tr.doc.resolve(selectionPos);
                        const newSelection = TextSelection.near($pos);
                        tr.setSelection(newSelection);

                        dispatch(tr);
                    }
                    return true;
                },
        };
    },
    addInputRules() {
        return [
            textblockTypeInputRule({
                find: backtickInputRegex,
                type: this.type,
                getAttributes: match => {
                    return {
                        language: mapLanguageAlias(match[1]),
                    };
                },
            }),
            textblockTypeInputRule({
                find: tildeInputRegex,
                type: this.type,
                getAttributes: match => {
                    return {
                        language: mapLanguageAlias(match[1]),
                    };
                },
            }),
        ];
    },
    addNodeView() {
        return ({ node, editor, getPos }) => {
            // Container wrapper
            const container = document.createElement('div');
            container.className = 'code-block-wrapper ';
            container.setAttribute('data-node-view-wrapper', '');

            // The actual pre element
            const pre = document.createElement('pre');
            pre.setAttribute('data-language', node.attrs.language || 'plaintext');

            // Code element for content
            const code = document.createElement('code');
            code.className = `hljs language-${node.attrs.language || 'plaintext'}`;
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

                const onResolve = () => {
                    if (typeof getPos !== 'function') return null;
                    const pos = getPos();
                    if (typeof pos !== 'number') return null;

                    // Force selection of the code block
                    editor.chain().focus().setNodeSelection(pos).run();

                    return {
                        pos,
                        message: {
                            type: 'codeBlockSelected',
                            language: node.attrs.language,
                            pos
                        }
                    };
                };

                if (this.options.onCodeBlockSelected) {
                    this.options.onCodeBlockSelected(e, onResolve);
                    return;
                }

                const result = onResolve();
                if (result) {
                    sendMessage(result.message);
                }
            };

            // Menu button (RIGHT) - 3 vertical dots
            const menuButton = document.createElement('button');
            menuButton.className = 'code-menu-btn';
            menuButton.type = 'button';
            menuButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

            menuButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const onResolve = () => {
                    if (typeof getPos !== 'function') return null;
                    const pos = getPos();
                    if (typeof pos !== 'number') return null;

                    return {
                        pos,
                        message: {
                            type: 'openBlockMenu',
                            blockType: 'codeBlock',
                            language: node.attrs.language,
                            pos
                        }
                    };
                };

                if (this.options.onOpenBlockMenu) {
                    this.options.onOpenBlockMenu(e, onResolve);
                    return;
                }

                const result = onResolve();
                if (result) {
                    sendMessage(result.message);
                }
            };

            // Ensure header is not treated as part of the editor content
            header.contentEditable = 'false';

            header.appendChild(langButton);
            header.appendChild(menuButton);

            // === LINE NUMBER GUTTER ===
            const gutter = document.createElement('div');
            gutter.className = 'code-gutter';
            gutter.contentEditable = 'false';

            let currentSettings = (window as any).editorSettings || { numberedLines: true };
            if (currentSettings.numberedLines === false) {
                container.classList.add('no-line-numbers');
                gutter.style.display = 'none';
            }

            let rafId: number | null = null;
            const syncGutter = () => {
                const text = code.textContent || '';
                const lineCount = text.split('\n').length;
                gutter.innerHTML = '';
                const fragment = document.createDocumentFragment();
                for (let i = 1; i <= lineCount; i++) {
                    const span = document.createElement('span');
                    span.textContent = String(i);
                    fragment.appendChild(span);
                }
                gutter.appendChild(fragment);
            };

            const queueSync = () => {
                if (rafId !== null) return;
                rafId = requestAnimationFrame(() => {
                    rafId = null;
                    syncGutter();
                });
            };

            const gutterObserver = new MutationObserver(() => queueSync());
            gutterObserver.observe(code, { characterData: true, childList: true, subtree: true });

            const handleSettingsChange = (e: any) => {
                currentSettings = e?.detail ?? (window as any).editorSettings ?? currentSettings;
                const isNumbered = currentSettings.numberedLines !== false;
                if (isNumbered) {
                    container.classList.remove('no-line-numbers');
                    gutter.style.display = '';
                    queueSync();
                } else {
                    container.classList.add('no-line-numbers');
                    gutter.style.display = 'none';
                }
            };
            window.addEventListener('annota-settings-change', handleSettingsChange);

            setTimeout(queueSync, 0);

            // Assemble DOM: header spans full width, gutter + pre sit side-by-side via CSS grid
            container.appendChild(header);
            container.appendChild(gutter);
            container.appendChild(pre);

            return {
                dom: container,
                contentDOM: code,
                ignoreMutation(mutation) {
                    // Ignore mutations outside contentDOM (header, gutter, etc.)
                    if (!code.contains(mutation.target as Node) && code !== mutation.target) {
                        return true;
                    }
                    return false;
                },
                stopEvent: (event) => {
                    // Prevent ProseMirror from interfering with header/gutter interactions
                    if (header.contains(event.target as Node) || gutter.contains(event.target as Node)) {
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
                    code.className = `hljs language-${lang}`;
                    const updatedLang = CODE_LANGUAGES.find(l => l.value === lang) || CODE_LANGUAGES[0];
                    langButton.textContent = updatedLang.label;
                    queueSync();
                    return true;
                },
                destroy() {
                    gutterObserver.disconnect();
                    window.removeEventListener('annota-settings-change', handleSettingsChange);
                    if (rafId !== null) cancelAnimationFrame(rafId);
                },
            };
        };
    },
}).configure({ lowlight, defaultLanguage: null });
