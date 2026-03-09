import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { sendMessage } from '../bridge';

// Initialize lowlight
export const lowlight = createLowlight(common);

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

// Custom CodeBlock with native interaction
export const CustomCodeBlock = CodeBlockLowlight.extend<any>({
    addOptions() {
        return {
            ...this.parent?.(),
            onOpenBlockMenu: null,
            onCodeBlockSelected: null,
        };
    },
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
                    code.className = `hljs language-${lang}`;
                    const updatedLang = CODE_LANGUAGES.find(l => l.value === lang) || CODE_LANGUAGES[0];
                    langButton.textContent = updatedLang.label;
                    return true;
                },
            };
        };
    },
}).configure({ lowlight, defaultLanguage: null });
