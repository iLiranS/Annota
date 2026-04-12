import { generateHTML, generateJSON } from '@tiptap/core';
import { marked } from 'marked';
import { getExtensions } from './config';

/**
 * Random ID generator for blocks
 */
function generateBlockId() {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Recursively adds missing IDs to nodes that expect them
 */
function processNodes(node: any) {
    if (!node) return;

    // Add ID to headings and details if missing
    if (node.type === 'heading' || node.type === 'details') {
        if (!node.attrs) node.attrs = {};
        if (!node.attrs.id) {
            node.attrs.id = generateBlockId();
        }
    }

    // Add imageId to images if missing and clear src to match canonical format
    if (node.type === 'image') {
        if (!node.attrs) node.attrs = {};
        if (!node.attrs.imageId) {
            node.attrs.imageId = `import-${generateBlockId()}`;
            // Canonical Annota format for images with imageId is src=""
            node.attrs.src = '';
        }
    }

    // Recurse
    if (node.content && Array.isArray(node.content)) {
        node.content.forEach(processNodes);
    }
}

/**
 * Converts raw Markdown text into Annota-compatible HTML.
 * Handles GFM tables, bold/italic, code blocks, and LaTeX math.
 */
export async function convertMarkdownToAnnotaHTML(markdown: string): Promise<string> {
    if (!markdown) {
        return '';
    }

    // 1. Pre-process LaTeX: extract math expressions and replace with placeholders
    //    so that marked doesn't mangle them.
    const mathPlaceholders: Map<string, { latex: string; isBlock: boolean }> = new Map();
    let placeholderIndex = 0;

    // Block math first ($$...$$ or \[...\])
    let processed = markdown.replace(/(?:\$\$|\\\[)([\s\S]+?)(?:\$\$|\\\])/g, (_match, latex: string) => {
        const key = `MATHBLOCK${placeholderIndex++}END`;
        mathPlaceholders.set(key, { latex: latex.trim(), isBlock: true });
        return key;
    });

    // Inline math ($...$ or \(...\))
    processed = processed.replace(/(?:\$|\\\()([^\$\n]+?)(?:\$|\\\))/g, (_match, latex: string) => {
        const key = `MATHINLINE${placeholderIndex++}END`;
        mathPlaceholders.set(key, { latex: latex.trim(), isBlock: false });
        return key;
    });

    // 2. Convert Markdown to basic HTML (with GFM tables enabled)
    marked.use({ gfm: true, breaks: false });
    let html = await marked.parse(processed);

    // 3. Run through TipTap roundtrip to "Annotize" headings etc.
    //    Placeholders survive as plain text nodes.
    try {
        const extensions = getExtensions({});
        const json = generateJSON(html, extensions);
        processNodes(json);
        html = generateHTML(json, extensions);
    } catch (err) {
        console.warn('[convertMarkdownToAnnotaHTML] TipTap roundtrip failed, using raw HTML:', err);
    }

    // 4. AFTER the roundtrip, replace placeholders with TipTap math HTML.
    //    insertContent will parse these via the math extension's parseHTML rules.
    for (const [key, { latex, isBlock }] of mathPlaceholders) {
        const escapedLatex = latex
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const mathHtml = isBlock
            ? `<div data-type="block-math" data-latex="${escapedLatex}"></div>`
            : `<span data-type="inline-math" data-latex="${escapedLatex}"></span>`;

        html = html.replaceAll(key, mathHtml);
    }

    return html;
}
