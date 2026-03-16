import { generateJSON, generateHTML } from '@tiptap/core';
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
 * High-performance, black-box utility for Annota.
 */
export async function convertMarkdownToAnnotaHTML(markdown: string): Promise<string> {
    if (!markdown) {
        return '';
    }

    // 1. Convert Markdown to basic HTML
    const basicHtml = await marked.parse(markdown);
    
    // 2. Convert to JSON to "Annotize" it (apply schemas, defaults, etc)
    const extensions = getExtensions({});
    const json = generateJSON(basicHtml, extensions);
    
    // 3. Post-process JSON to add IDs (e.g. for headings)
    processNodes(json);
    
    // 4. Convert back to "canonical" Annota HTML
    const finalHtml = generateHTML(json, extensions);
    
    return finalHtml;
}
