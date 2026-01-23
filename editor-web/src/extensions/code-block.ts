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
export const CustomCodeBlock = CodeBlockLowlight.extend({
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
